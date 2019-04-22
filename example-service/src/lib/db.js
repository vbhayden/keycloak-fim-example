const orientjs = require("orientjs");

const DB_NAME = "FIM";
const CLASS_USER = "User";
const CLASS_REALM = "Realm";

const CLASS_ALIAS_FOR = "AliasFor";
const CLASS_BELONGS_TO = "BelongsTo";
const CLASS_FEDERATES = "Federates";

const server = orientjs({
    host: (process.env.ORIENT_HOST || "192.168.30.231"),
    port: (process.env.ORIENT_PORT || "2424"),
    username: (process.env.ORIENT_USER || "root"),
    password: (process.env.ORIENT_PASS || "root"),
});

/** @type {orientjs.Db} */
var db = undefined;

// Make sure we have the right DB schema in place
server.list()
    // Make sure we have our FIM database
    .then(dbs => {
        for (let found of dbs) {
            if (found.name == DB_NAME) {
                return found;
            }
        }
        if (db == undefined) {
            return server.create({
                name: DB_NAME,
                type: 'graph',
                storage: 'plocal'
            })
        }
    })
    // Make sure we have our classes
    .then(database => {
        console.log(`[Orient] Database ${DB_NAME} Verfied ...`)
        db = database
        return Promise.all([
            database.class.create(CLASS_USER, "V", null, false, true),
            database.class.create(CLASS_REALM, "V", null, false, true),
            database.class.create(CLASS_ALIAS_FOR, "E", null, false, true),
            database.class.create(CLASS_BELONGS_TO, "E", null, false, true),
            database.class.create(CLASS_FEDERATES, "E", null, false, true)
        ])
    })
    // Make sure those classes have the right properties
    .then(verifiedClasses => {
        console.log("[Orient] Verified DB Classes ...");

        let [users, realms, _, __, ___] = verifiedClasses
        let props = [{
                name: "id",
                type: "String",
                ifnotexist: true,
            },
            {
                name: "name",
                type: "String",
                ifnotexist: true,
            },
            {
                name: "master",
                type: "Boolean",
                ifnotexist: true,
            }
        ]

        return Promise.all([
            users.property.create(props),
            realms.property.create(props)
        ])
    })
    .then(verifiedProps => {
        console.log(`[Orient] Verified Class Properties.`);
    });

function orientQuery(query) {
    return db.query(query).then(results => {
        return results.map(orientObj => {
            return {
                id: orientObj.id,
                name: orientObj.name,
                master: orientObj.master,
            }
        })
    });
}

function orientQueryFirst(query) {
    return orientQuery(query)
        .then(results => {
            if (results.length > 0)
                return results[0]
            else
                return null
        })
}


module.exports = {

    /**
     * Returns the current Database object connected to our OrientDB instance.
     * @return {} Promise passing an object with the user's master account.
     */
    db: () => {
        return db;
    },

    /**
     * Retrieves the master alias for the given user ID / realm pair.
     * @param {string} id User's realm-specific ID.
     * @param {string} realm Realm to query on.
     * @return {Promise<{id: string, name: string}>} Promise passing an object with the user's master account.
     */
    getMasterAlias: function (user, realm) {
        let query = `
            select expand(out("AliasFor")) from (
                select expand(in("BelongsTo")) from Realm where id = "${db.escape(realm)}"
            ) where id = "${db.escape(user)}"
        `
        return orientQueryFirst(query);
    },

    /**
     * Retrieves the master alias for the given user ID / realm pair.
     * @param {string} master User's master ID.
     * @param {string} realm Realm to query on.
     * @return {Promise<{{id: string, name: string}}>} Promise passing an object with the user's realm-specific account.
     */
    getRealmAlias: function (master, realm) {
        let query = `
            SELECT expand(intersect(
                (select expand(in("AliasFor")) from User where id = "${db.escape(master)}"),
                (select expand(in("BelongsTo")) from Realm where id = "${db.escape(realm)}")
            ))
        `
        return orientQueryFirst(query);
    },

    /**
     * Retrieve all uses on a given realm.
     * @param {string} realm Realm ID to query.
     */
    getUsersOnRealm: function(realm) {
        let query = `select expand(in("BelongsTo")) from Realm where id = "${db.escape(realm)}"`
        return orientQuery(query);
    },

    /**
     * Retrieve the user account for a given user ID.
     * @param {string} user User ID to query.
     */
    getUser: function(user) {
        let query = `select * from User where id = "${db.escape(user)}"`
        return orientQuery(query);
    },

    /**
     * Retrieve all use accounts.
     */
    getUsers: function() {
        let query = `select * from User`
        return orientQuery(query);
    },

    /**
     * Retrieve all use accounts.
     */
    getNormalUsers: function() {
        let query = `select * from User where master = false`
        return orientQuery(query);
    },

    /**
     * Retrieve all use accounts.
     */
    getMasterUsers: function() {
        let query = `select * from User where master = true`
        return orientQuery(query);
    },

    /**
     * Retrieve all realms.
     */
    getRealms: function() {
        let query = `select * from Realm`
        return orientQuery(query);
    },

    /**
     * Retrieves the master alias for the given user ID / realm pair.
     * @param {Number} userCount
     */
    insertDummyData: function(userCount) {
           
       let rid = (entry) => {
           let record = entry["@rid"]
           return `${record.cluster}:${record.position}`
       }
   
       let vertexPromise = (className, instanceName, isMaster) => {
           return db.insert().into(className).set({
               id: db.rawExpression("format('%s',uuid())"),
               name: instanceName,
               master: isMaster
           }).one()
       }
       let edgePromise = (className, from, to) => {
           return db.create("EDGE", className)
           .from(rid(from))
           .to(rid(to))
           .one()
       }
   
       // Create our example realms
       return Promise.all([
           vertexPromise(CLASS_REALM, "A", false),
           vertexPromise(CLASS_REALM, "B", false),
           vertexPromise(CLASS_REALM, "MASTER", true),
       ])
   
       // Create users on these realms
       .then(realms => {
           let [ra, rb, rm] = realms;
   
           return Promise.all([
               edgePromise(CLASS_FEDERATES, rm, ra),
               edgePromise(CLASS_FEDERATES, rm, rb),
               realms
           ])
       })
       .then(data => {
           let [_, __, realms] = data
           let [ra, rb, rm] = realms;
           let promises = []
   
           for (let k=1; k<userCount+1; k++) {
               
               // Create the user's various aliases
               promises[k-1] = Promise.all([
                   vertexPromise(CLASS_USER, `RA-User-${k}`, false),
                   vertexPromise(CLASS_USER, `RB-User-${k}`, false),
                   vertexPromise(CLASS_USER, `MASTER-User-${k}`, true),
               ])
               // Map those edges to their realms and the user's master alias
               .then(users => {
                   let [ua, ub, um] = users;
                   return Promise.all([
                       edgePromise(CLASS_BELONGS_TO, ua, ra),
                       edgePromise(CLASS_BELONGS_TO, ub, rb),
                       edgePromise(CLASS_BELONGS_TO, um, rm),
   
                       edgePromise(CLASS_ALIAS_FOR, ua, um),
                       edgePromise(CLASS_ALIAS_FOR, ub, um),
                   ])
               })
           }
   
           return Promise.all(promises);
       })
       .then(insertions => {
           console.log(`[Orient] Inserted ${insertions.length} records of dummy data.`)
       })
   }
}