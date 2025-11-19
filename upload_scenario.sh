#/bin/bash
rsync -vP -e "ssh -p 2002"  --filter="+ *.tar" --filter="- *" podman-postgres/sofime_scenario_001.tar reflexe@jenkins.reflexe.fr:/home/reflexe/scenario/
 
