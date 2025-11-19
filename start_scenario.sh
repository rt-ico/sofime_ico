#/bin/bash
rsync -vP -e "ssh -p 2002"  --filter="+ *.tar" --filter="- *" reflexe@jenkins.reflexe.fr:/home/reflexe/scenario/sofime_scenario_001.tar podman-postgres/sofime_scenario_001.tar 
podman-compose up 
 
