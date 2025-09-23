FROM docker.io/openjdk:8

#usr/lib/jvm/jdk1.8.0_191/jre/bin/java 
#-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=9175 -ea -XX:+StartAttachListener -XX:+UseG1GC -XX:+UseStringDeduplication 
#-Xloggc:/home/pbo/dev/java/projects/sofime_reloc/home/logs/garbage.log -XX:+PrintGCTimeStamps -Xmx512m 
#-DVSH_HOME=/home/pbo/dev/java/projects/sofime_reloc/home -DVSH_LOG_LEVEL=DEBUG -DVSH_LOG_ROLL_TYPE=NONE -DVSH_LOG_APPEND=FALSE -DVSH_LOCALHOST_DEFAULT=TRUE -Djava.awt.headless=true -jar /home/pbo/dev/java/projects/sofime_reloc/conf/sdk/viewshell.jar


ENV user=vsh
ENV uid=1000
ENV group=vshgroup
ENV gid=1000
ENV home=/home/$user

# Création d’un groupe non-root
RUN groupadd --gid ${gid} ${group}
#RUN groupadd --help
#RUN groupadd --gid 1000 vshgroup

# Création d’un utilisateur sans mot de passe
RUN adduser \
    --disabled-password \
    --home "$home" \
    --ingroup "$group" \
    --uid $uid \
    --gecos "" \
    "$user"

USER vsh
WORKDIR $home


RUN mkdir /home/vsh/logs/
RUN chown $user:$group /home/vsh/logs/
COPY --chown="$user:$group" conf/ /home/vsh/conf/
COPY --chown="$user:$group" plugins/ /home/vsh/plugins/
COPY --chown="$user:$group" sdk/ /opt/sdk/
COPY --chown="$user:$group" themes/ /home/vsh/themes/

WORKDIR "/home/$user"

#RUN java -agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=9175 -ea -XX:+StartAttachListener -XX:+UseG1GC -XX:+UseStringDeduplication \
#-Xloggc:/home/vsh/logs/garbage.log -XX:+PrintGCTimeStamps -Xmx512m \
#-DVSH_HOME=/home/vsh/ \
#-DVSH_LOG_LEVEL=DEBUG -DVSH_LOG_ROLL_TYPE=NONE -DVSH_LOG_APPEND=FALSE -DVSH_LOCALHOST_DEFAULT=TRUE -Djava.awt.headless=true \
#-jar /opt/sdk/viewshell.jar

ENTRYPOINT ["java", "-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=9175", "-ea", "-XX:+StartAttachListener", "-XX:+UseG1GC", "-XX:+UseStringDeduplication", \
"-Xloggc:/home/vsh/logs/garbage.log", "-XX:+PrintGCTimeStamps", "-Xmx512m", \
"-DVSH_HOME=/home/vsh/", \
"-DVSH_LOG_LEVEL=DEBUG", "-DVSH_LOG_ROLL_TYPE=NONE", "-DVSH_LOG_APPEND=FALSE", "-DVSH_LOCALHOST_DEFAULT=TRUE", "-Djava.awt.headless=true", \
"-jar", "/opt/sdk/viewshell.jar"]
