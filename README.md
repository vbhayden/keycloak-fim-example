Keycloak Federation Examples
--------------
This project is a Dockerized service architecture to protect an federated identity resolution service.

This configuration is intended to run on an Ubuntu 16.04+ OS, but later versions should work at well.  Docker for Windows and Mac have not been tested.

**Note: This project was created for educational purposes.  Always use caution when pulling code from the interne, especially anything to be used in your security stack.**

## What's in the box?
This project will create Docker containers for the following services:
- Keycloak (version 4.5.0.Final)
- Nginx
- OrientDB (for storing the federated ID mappings)
- A Postgres instance for Keycloak
- A simple NodeJS service exposing an API to interact with the OrientDB instance

## How to Use
As this project is centered around Docker, there's very little setup required on the host machine. 

### TL;DR
1. `git clone https://github.com/vbhayden/keycloak-federation-examples`
1. `cd keycloak-federation-examples`
1. `sudo ./install-reqs.sh`
1. `sudo ./rebuild.sh`

### Further detail coming later
