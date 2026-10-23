FROM nginx:1.27-alpine
RUN rm -f /etc/nginx/conf.d/default.conf
COPY docker/nginx/web.conf.template /etc/nginx/conf.d/default.conf
COPY out/product-a-demo/ /usr/share/nginx/html/
EXPOSE 8080
