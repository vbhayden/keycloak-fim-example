FROM nginx:alpine

ARG HOSTNAME

# Generate a dummy SSL cert
#
RUN 	apk update && \ 
	apk add openssl && \
	mkdir -p /etc/ssl/certs && \
	mkdir -p /etc/ssl/private && \
	openssl req \
		-subj "/C=US/ST=VA/O=ADL Initiative/CN=$HOSTNAME" \
		-new \
		-newkey rsa:4096 \
		-days 365 \
		-nodes \
		-x509 \
		-sha256 \
		-keyout /etc/ssl/private/$HOSTNAME.key \
		-out /etc/ssl/certs/$HOSTNAME.crt

# Move our configuration into place
#
COPY 	default.conf /etc/nginx/nginx.conf
COPY 	proxy_headers.conf /etc/nginx/proxy_headers.conf

# Swap our environment variables
#
RUN 	cat /etc/nginx/nginx.conf | \
	envsubst '$HOSTNAME' | \
	tee /tmp/nginx.conf

RUN 	mv /tmp/nginx.conf /etc/nginx/nginx.conf



