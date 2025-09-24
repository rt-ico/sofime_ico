pipeline {
    agent any

    environment {
        PG_CONTAINER_NAME = "pg_sofime_ico"
        POSTGRES_PASSWORD = "not24get"
        PG_IMAGE = "pg_sofime_ico" // image avec libfaketime
        SQL_SCRIPT = "deploy.sql"             // script SQL à injecter
    }

    stages {

        stage('Lancer le conteneur PostgreSQL') {
            steps {

            script {
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
                            --name $PG_CONTAINER_NAME \
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


        stage('Lancement d\'OpenAGE Forms) {
          /*  when {
                expression { params.mode == 'Run' }
            }*/

            steps {
                script {
                    // Vérification et clonage du dépôt si nécessaire

                    sh '''if ! test -d OpenAGE; then
		                git clone git@github.com:rt-admin/OpenAGE.git
			        fi'''

                    sh 'cp config_file/build-OpenAGE.properties OpenAGE/'
                    dir("OpenAGE") {
                        sh 'git pull'
                        sh 'git checkout master'
                        withAnt(installation: 'Ant:1.9.13', jdk: 'Java1.6') {
                            sh 'ant -Dbin-dist-folder=../../podman-tomcat/ build-webapp'
                        }
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
