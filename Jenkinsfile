pipeline {
    agent any

    environment {
        CONTAINER_NAME = "postgres"
        POSTGRES_PASSWORD = "not24get"
        POSTGRES_IMAGE = "postgres" // image avec libfaketime
        SQL_SCRIPT = "deploy.sql"             // script SQL à injecter
    }

    stages {

        stage('Lancer le conteneur PostgreSQL') {
            steps {
                sh """
                # Stopper l'ancien conteneur s'il existe
                podman stop $CONTAINER_NAME 2>/dev/null || true
                
                podman run --rm -v pgdata:/data alpine sh -c "rm -rf /data/*"
                podman volume import pgdata /mnt/dump/sofime/postgres-data-20250919.tar

                # Lancer le conteneur initial avec date par défaut
                podman run -d --rm \
                    --name $CONTAINER_NAME \
                    -e POSTGRES_PASSWORD=not24get \
                    -e POSTGRES_DB=oa_prod \
                    -e FAKETIME_SHM_DISABLE=1 \
                    -e LD_PRELOAD=/usr/lib/x86_64-linux-gnu/faketime/libfaketime.so.1 \
                    -e FAKETIME="2025-09-19 14:00:00" \
                    -p 5433:5432 \
                    -v pgdata:/var/lib/postgresql/data \
                    -v /dev/shm:/dev/shm \
                    $POSTGRES_IMAGE
                """
            }
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
                        sh 'git pull'
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
                        //    sh 'podman build --build-arg EXPOSED_PORT=${EXPOSED_PORT} --build-arg WAR_NAME=openage --build-arg CONTAINER_NAME_DB=${CONTAINER_NAME_DB} --tag  ${IMAGE_NAME_VS} .'
                        //    sh "podman run -d -p 9171:9170 -h ${IMAGE_NAME_VS} --network=${NETWORK} --name  ${CONTAINER_NAME_VS} ${IMAGE_NAME_VS}"
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
                podman exec -i $CONTAINER_NAME psql -U postgres < sofime_reloc/deploy/$SQL_SCRIPT
                """
            }
        }

        stage('Redéployer le conteneur avec nouvelle date') {
            steps {
                sh """
                # Nouvelle date simulée
                NEW_DATE="2025-09-20 09:00:00"

                # Stopper l'ancien conteneur
                podman stop $CONTAINER_NAME

                # Redéployer avec la nouvelle date
                podman run -d  \
                    --name $CONTAINER_NAME \
                    -e POSTGRES_PASSWORD=not24get \
                    -e POSTGRES_DB=oa_prod \
                    -e FAKETIME_SHM_DISABLE=1 \
                    -e LD_PRELOAD=/usr/lib/x86_64-linux-gnu/faketime/libfaketime.so.1 \
                    -e FAKETIME="2025-09-19 14:00:00" \
                    -p 5433:5432 \
                    -v pgdata:/var/lib/postgresql/data \
                    -v /dev/shm:/dev/shm \
                    $POSTGRES_IMAGE
                """
            }
        }

        stage('Vérifier le trigger') {
            steps {
                sh """
                # Attendre le démarrage
                sleep 15

                # Vérifier les résultats dans la table de logs
                podman exec -i $CONTAINER_NAME psql -U postgres -c "SELECT * FROM logs;"
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
