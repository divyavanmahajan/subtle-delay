FROM collinestes/docker-node-oracle
MAINTAINER divya.mahajan@philips.com

RUN apt-get update && apt-get install -y supervisor && mkdir -p /var/log/supervisor
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
CMD ["/usr/bin/supervisord"]
