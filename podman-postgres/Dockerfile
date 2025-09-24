#
# NOTE: THIS DOCKERFILE IS GENERATED VIA "apply-templates.sh"
#
# PLEASE DO NOT EDIT IT DIRECTLY.
#

FROM docker.io/postgis/postgis:14-3.5

ENV POSTGRES_PASSWORD=not24get
ENV POSTGRES_HOST_AUTH_METHOD=md5

#COPY podman-entrypoint.sh /usr/local/bin/podman-entrypoint.sh
#RUN chmod +x /usr/local/bin/podman-entrypoint.sh

#COPY mydb.sql /docker-entrypoint-initdb.d/
RUN mkdir -p  /etc/postgresql/
COPY my-postgres.conf /etc/postgresql/postgresql.conf

ENV POSTGRES_DB=oa_prod

RUN apt-get update && apt-get install -y libfaketime && rm -rf /var/lib/apt/lists/*

EXPOSE 5432

#ENTRYPOINT ["/usr/local/bin/podman-entrypoint.sh"]
CMD ["postgres"]
