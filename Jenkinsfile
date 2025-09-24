pipeline {
    agent any

    environment {
        PG_IMAGE = "pg_sofime_ico" // image avec libfaketime
        PG_CONTAINER_NAME = "pg_sofime_ico"

        IMAGE_NAME_HTTP="sofime_http"
        CONTAINER_NAME_HTTP="sofime_http"

        NETWORK_NAME = "sofime_ico"

        POSTGRES_PASSWORD = "not24get"
        SQL_SCRIPT = "deploy.sql"             // script SQL à injecter
    }

    stages {

        stage('Lancer le conteneur PostgreSQL') {
            steps {
                script {
                    def netExists = sh(
                            script: "podman network exists ${NETWORK_NAME} && echo true || echo false",
                            returnStdout: true
                    ).trim()

                    if (netExists == "true") {
                        echo "✅ Le réseau ${NETWORK_NAME} existe déjà."
                    } else {
                        echo "⚠️ Le réseau ${NETWORK_NAME} n'existe pas, création en cours..."
                        sh "podman network create ${NETWORK_NAME}"
                    }

                    dir("podman-postgres") {
                        // Vérifie si l’image existe
                        def imageExists = sh(
                                script: "podman image exists ${PG_IMAGE} && echo true || echo false",
                                returnStdout: true
                        ).trim()

                        if (imageExists == "true") {
                            echo "✅ L'image ${PG_IMAGE} existe déjà, pas de build nécessaire."
                        } else {
                            echo "⚠️ L'image ${PG_IMAGE} n'existe pas, lancement du build..."
                            sh "podman build -t ${PG_IMAGE} ."
                        }
                    }
                }
                //   dir("podman-postgres") {
                sh """
                        # Stopper l'ancien conteneur s'il existe
                        podman stop $PG_CONTAINER_NAME 2>/dev/null || true

                        podman run --rm -v pg_sofime_ico:/data alpine sh -c "rm -rf /data/*"
                        podman volume import pg_sofime_ico podman-postgres/sofime_scenario_001.tar

                        # Lancer le conteneur initial avec date par défaut
                        podman run -d --rm \
                            --replace \
                            --name $PG_CONTAINER_NAME \
                            --network=${NETWORK_NAME} \
                            -e POSTGRES_PASSWORD=not24get \
                            -e POSTGRES_DB=oa_prod \
                            -e FAKETIME_SHM_DISABLE=1 \
                            -e LD_PRELOAD=/usr/lib/x86_64-linux-gnu/faketime/libfaketime.so.1 \
                            -e FAKETIME="2025-09-19 14:00:00" \
                            -p 5433:5432 \
                            -v pg_sofime_ico:/var/lib/postgresql/data \
                            -v /dev/shm:/dev/shm \
                            $PG_IMAGE
                        """
            }
            //  }

        }

        stage('Mise à jour et construction de l\'application Sofime') {
            steps {
                script {
                    // Vérification et clonage du dépôt si nécessaire

                    sh '''if ! test -d sofime_reloc; then
		           git clone git@github.com:rt-admin/sofime_reloc.git
			        fi'''

                    // sh 'cp config_file/build-OpenAGE.properties OpenAGE/'
                    dir("sofime_reloc") {
                        sh 'git checkout master && git pull'
                        //sh 'git checkout master'
                        //    withAnt(installation: 'Ant:1.9.13', jdk: 'Java1.8') {
                        //        sh 'ant dist'
                        //   }
                        //    //
                        //    sh 'cp -rL conf/sdk/ ../podman-vs/'
                        //    sh 'cp -rL target/pub/plugins/ ../podman-vs/'
                        //    sh 'cp -rL target/pub/themes/ ../podman-vs/'
                        //    sh 'cp -rL target/pub/openage ../podman-tomcat/'
                        // }
                        // dir("podman-vs") {
                        //    //sh "podman image rm ${IMAGE_NAME_VS}"
                        //    sh 'podman build --build-arg EXPOSED_PORT=${EXPOSED_PORT} --build-arg WAR_NAME=openage --build-arg PG_CONTAINER_NAME_DB=${PG_CONTAINER_NAME_DB} --tag  ${IMAGE_NAME_VS} .'
                        //    sh "podman run -d -p 9171:9170 -h ${IMAGE_NAME_VS} --network=${NETWORK} --name  ${PG_CONTAINER_NAME_VS} ${IMAGE_NAME_VS}"
                        //}
                    }
                }
            }
        }

        stage('Appliquer le script SQL initial') {
            steps {
                sh """
                # Attendre que PostgreSQL soit prêt
                sleep 15

                # Injecter le script SQL
                podman exec -i $PG_CONTAINER_NAME psql -U postgres < sofime_reloc/deploy/$SQL_SCRIPT
                """
            }
        }

        stage('Redéployer le conteneur avec nouvelle date') {
            steps {
                sh """
                # Nouvelle date simulée
                NEW_DATE="2025-09-20 09:00:00"

                # Stopper l'ancien conteneur
                podman stop $PG_CONTAINER_NAME

                # Redéployer avec la nouvelle date
                podman run -d  \
                    --name $PG_CONTAINER_NAME \
                    --network=${NETWORK_NAME} \
                    -e POSTGRES_PASSWORD=not24get \
                    -e POSTGRES_DB=oa_prod \
                    -e FAKETIME_SHM_DISABLE=1 \
                    -e LD_PRELOAD=/usr/lib/x86_64-linux-gnu/faketime/libfaketime.so.1 \
                    -e FAKETIME="2025-09-19 14:00:00" \
                    -p 5433:5432 \
                    -v pg_sofime_ico:/var/lib/postgresql/data \
                    -v /dev/shm:/dev/shm \
                    $PG_IMAGE
                """
            }
        }


        stage('Lancement d\'OpenAGE Forms') {
            /*  when {
                  expression { params.mode == 'Run' }
              }*/

            steps {
                script {
                    // Vérification et clonage du dépôt si nécessaire

                    sh '''if ! test -d OpenAGE; then
		                git clone git@github.com:rt-admin/OpenAGE.git
		                sh 'git pull'
                        sh 'git checkout master'
			        fi'''

                    sh 'cp config_file/build-OpenAGE.properties OpenAGE/'
                    dir("OpenAGE") {
                        sh "git fetch git@github.com:rt-admin/OpenAGE.git master"

                        // Comparer le dernier commit local et distant
                        def localCommit = sh(script: "git rev-parse HEAD", returnStdout: true).trim()
                        def remoteCommit = sh(script: "git rev-parse FETCH_HEAD", returnStdout: true).trim()
                        if (localCommit == remoteCommit) {
                            echo "✅ Pas de mise à jour disponible, aucune action lancée."

                        } else {
                            echo "⚠️ Nouvelle mise à jour OpenAGE Forms détectée sur master."
                            // Ici tu mets ton action conditionnelle
                            withAnt(installation: 'Ant:1.9.13', jdk: 'Java1.6') {
                                sh 'ant -Dbin-dist-folder=../../podman-tomcat/ build-webapp'
                            }
                        }
                    }
                    dir("podman-tomcat") {
                        echo "Construction de l'image podman pour Tomcat..."
                        sh 'java -jar ../tools/keycodec.jar ${IMAGE_NAME_HTTP} enterprise > openage/context/openage/install/licence.txt'
                        sh 'podman build --build-arg EXPOSED_PORT=${EXPOSED_PORT} --build-arg WAR_NAME=openage --build-arg CONTAINER_NAME_DB=${CONTAINER_NAME_DB} --tag  ${IMAGE_NAME_HTTP} .'
                        echo "Lancement du conteneur Tomcat..."
                        // Utilisation de la variable EXPOSED_PORT pour exposer le bon port
                        sh "podman run -d -p 8042:8042 -p ${EXPOSED_PORT}:8080 -h ${IMAGE_NAME_HTTP} --network=${NETWORK_NAME} --name  ${CONTAINER_NAME_HTTP} ${IMAGE_NAME_HTTP}"
                    }
                }
            }
        }

        stage('Vérifier le trigger') {
            steps {
                sh """
                # Attendre le démarrage
                sleep 15

                # Vérifier les résultats dans la table de logs
                podman exec -i $PG_CONTAINER_NAME psql -U postgres -c "SELECT * FROM expats;"
                """
            }
        }
    }

    //post {
    //    always {
    //      //  sh "podman stop $CONTAINER_NAME 2>/dev/null || true"
//        }
    //  }
}
