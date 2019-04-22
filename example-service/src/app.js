//
// This is an example NodeJS Express application using Keycloak
//
const fs = require("fs");
const cors = require("cors");
const express = require('express');
const session = require('express-session');
const bodyParser = require("body-parser");
const Keycloak = require('keycloak-connect');

const dbWrapper = require("./lib/db");

// Read our Keycloak config file
const keycloakConfig = JSON.parse(fs.readFileSync("./keycloak.json"));
const keycloakHost = (process.env.KEYCLOAK_HOST || "192.168.30.231")

// Adjust for our docker env variable
keycloakConfig["auth-server-url"] = `https://${keycloakHost}/auth`

// Constants
const PORT = (process.env.SERVICE_PORT || 3000);

// Create an instance of the express class and declare our port
const app = express();
const memory = new session.MemoryStore();
const keycloak = new Keycloak({
    store: memory
}, keycloakConfig);

// Set up our session        
app.use(
    session({
        secret: "secret",
        resave: false,
        saveUninitialized: true,
        store: memory
    })
);

// Set EJS as our view engine for partial templates
app.set("view engine", "ejs");
app.set('json spaces', 2);

// Use our keycloak middleware
app.use(keycloak.middleware());

// Boiletplate middleware
app.use(bodyParser.json())
app.use(cors())

// Get our static files.  We're keeping these in a few different places, so this
// might get sort of confusing when looking directly at the href paths
app.use(express.static("public"));
app.use(express.static("views"));
app.use("/aka", express.static("public"));
app.use("/aka", express.static("views"));

// Set our renderer and configurations
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
    extended: false
}));

app.get("/aka", function (req, res, next) {
    res.render("index");
});

app.get("/aka/api", function (req, res, next) {
    res.render("api");
});

app.get("/aka/api/realms", function(req, res, next) {
    dbWrapper.getRealms()
        .then(realms => {
            res.json(realms)
        })
})

app.get("/aka/api/users", function(req, res, next) {

    let master = req.query.master
    if (master === undefined)
        dbWrapper.getUsers(master)
            .then(users => {
                res.json(users)
            })
    else if (master == 1)
        dbWrapper.getMasterUsers(master)
            .then(users => {
                res.json(users)
            })
    else 
        dbWrapper.getNormalUsers(master)
            .then(users => {
                res.json(users)
            })          
})

app.get("/aka/api/query", function(req, res, next) {

    let user = req.query.user
    let realm = req.query.realm
    let master = req.query.master

    if (user && master) {
        res.status(400).send(`Cannot supply both {master} and {user} together, specify one with {realm}`)
        return;
    }

    if (user && realm) {
        dbWrapper.getMasterAlias(user, realm)
            .then(masterAlias => {
                if (masterAlias == undefined)
                    res.status(400).send(`No master ID found for User ${user} on realm ${realm} `)
                else
                    res.json(masterAlias)
            })
    } else if (master && realm) {
        dbWrapper.getRealmAlias(master, realm)
            .then(realmAlias => {
                if (realmAlias == undefined)
                    res.status(400).send(`No realm ID found for User ${master} on realm ${realm} `)
                else
                    res.json(realmAlias)
            })
    } else if (realm) {
        dbWrapper.getUsersOnRealm(realm)
            .then(users => {
                res.json(users)
            })
    }
    else {
        res.status(400).send(`Must specify {master} or {user} with a {realm}`)
        return;
    }
})

// Start the service
app.listen(PORT, function () {
    console.log(`\n[Server] listening on port ${PORT} ...`)
});

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";