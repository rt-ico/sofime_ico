 build image :
 docker buildx build --tag sf_db_img .
 
 
 Run container :
 docker run -d -p 8585:5432 -h sf_db_ct --network=sf-db-net --name  sf_db_ct sf_db_img
 
 Import data :
 pg_restore -h localhost -p 8585 -U postgres -v -F c -d sofime mydb.sql
 
 Commit image :
 docker commit sf_db_ct sf_db_ct:01
