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

// Adjust for our docker env variable
keycloakConfig["auth-server-url"] = "https://192.168.30.231/auth"

// Constants
const PORT = (process.env.port || 3000);

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

// Set our renderer and configurations
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
    extended: false
}));

app.use(function (req, res, next) {

    // Use a callback to check whether our user's token has the given
    // roles required to access parts of the site.
    //
    function confirmRoles(token, request) {

        // At the time of this callback, we'll already have a token from
        // the Keycloak user.  The role confirmation will just be here
        // to append that role verification to the response variable.
        //
        res.locals.admin = token.hasRole("realm:admin");

        // False here will force a hideous redirect to the Keycloak "permission denied"
        // page, so we'll want to handle that more gracefully.
        return true;
    }

    // Unpack the middleware
    let protect = keycloak.protect(confirmRoles);

    protect(req, res, next);
})

// Redirecting someone to logout once their state gets weird
keycloak.accessDenied = function (req, res, next) {
    res.redirect("/logout")
}

// Get our user information
app.use(function (req, res, next) {

    // This isn't really documented, but we can use the access token to get our user info
    if (req.kauth && req.kauth.grant && req.kauth.grant.access_token) {


        let content = req.kauth.grant.access_token.content;

        res.locals.id = content.sub;
        res.locals.username = content.preferred_username;
    }
    next();
});

app.get("/aka", function (req, res, next) {

    res.render("index", {
        admin: res.locals.admin,
        id: res.locals.id,
        user: res.locals.username
    });
});

app.get("/aka/:realm/:id", function (req, res, next) {

    dbWrapper.getMasterAlias(req.params.id, req.params.realm, function (masterId) {
        res.render("index", {
            admin: res.locals.admin,
            id: masterId,
            user: res.locals.username
        });
    });
});
app.get("*", function (req, res, next) {
    res.redirect("/aka");
});

// There's a problem if this is included earlier, not sure why
app.use(keycloak.middleware({
    logout: '/'
}));

// Start the service
app.listen(PORT, function () {
    console.log(`\n[Server] listening on port ${PORT} ...`)
});

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
