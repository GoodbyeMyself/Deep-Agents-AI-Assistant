FROM nginx:1.27-alpine

RUN rm -f /etc/nginx/conf.d/default.conf

COPY docker/nginx/web.conf.template /etc/nginx/templates/default.conf.template
COPY out/web/ /usr/share/nginx/html/

EXPOSE 8080
