FROM nginx

ADD nginx_conf/nginx.conf /etc/nginx/nginx.conf

COPY dist /usr/share/nginx/html/app/

EXPOSE 80
