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
        console.log("[Orient] Verified Classes ...");

        let [users, realms, a, b, c] = verifiedClasses
        let props = [{
                name: "id",
                type: "String",
                ifnotexist: true,
            },
            {
                name: "name",
                type: "String",
                ifnotexist: true,
            }
        ]

        return Promise.all([
            users.property.create(props),
            realms.property.create(props)
        ])
    })
    .then(verifiedProps => {
        console.log(`[Orient] Verified Class Properties.  DB connection is all set.`);
    });

function orientQuery(query) {
    return db.query(query).then(results => {
        return results.map(orientObj => {
            return {
                id: orientObj.id,
                name: orientObj.name
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
     */
    db: () => {
        return db;
    },

    /**
     * Callback returning a master ID.
     *
     * @callback idReturnCallback
     * @param {string} id - The ID representing the user in your master FIM system.
     */
    /**
     * Retrieves the master alias for the given user ID / realm pair.
     * @param {string} id User's realm-specific ID.
     * @param {string} realm Realm to query on.
     * @return {Promise<string>} The user's master ID.
     */
    getMasterAlias: function (user, realm) {

        let query = `
            select * from (
                select expand(out("AliasFor")) from (
                    select expand(in("BelongsTo")) from Realm where id = "${db.escape(realm)}"
                ) where id = "${db.escape(user)}"
            )
        `
        return orientQueryFirst(query);
    },

    /**
     * 
     * @param {Realm} realm 
     */
    getUsersOnRealm: function(realm) {
        let query = `select expand(in("BelongsTo")) from Realm where id = "${db.escape(realm)}"`
        return orientQuery(query);
    },

    getUser: function(user) {
        let query = `select * from User where id = "${db.escape(user)}"`
        return orientQuery(query);
    },

    getUsers: function(user) {
        let query = `select * from User`
        return orientQuery(query);
    },

    getRealms: function() {
        let query = `select * from Realm`
        return orientQuery(query);
    },

    /**
     * Callback returning a master ID.
     *
     * @callback dummyDataCallback
     */
    /**
     * Retrieves the master alias for the given user ID / realm pair.
     * @param {Number} users
     * @param {dummyDataCallback} callback 
     */
    insertDummyData: function(users, callback) {
        
        let rid = (entry) => {
            let record = entry["@rid"]
            return `${record.cluster}:${record.position}`
        }

        let vertexPromise = (className, instanceName) => {
            return db.insert().into(className).set({
                id: db.rawExpression("format('%s',uuid())"),
                name: instanceName
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
            vertexPromise(CLASS_REALM, "A"),
            vertexPromise(CLASS_REALM, "B"),
            vertexPromise(CLASS_REALM, "MASTER"),
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

            for (let k=1; k<users+1; k++) {
                
                // Create the user's various aliases
                promises[k-1] = Promise.all([
                    vertexPromise(CLASS_USER, `RA-User-${k}`),
                    vertexPromise(CLASS_USER, `RB-User-${k}`),
                    vertexPromise(CLASS_USER, `MASTER-User-${k}`),
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