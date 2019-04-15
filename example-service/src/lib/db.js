const orientjs = require("orientjs");

const DB_NAME = "FIM";
const CLASS_ALIAS_NAME = "User";
const CLASS_REALM_NAME = "Realm";

const server = orientjs({
    host: (process.env.ORIENT_HOST || "192.168.30.231"),
    port: (process.env.ORIENT_PORT || "2424"),
    username: (process.env.ORIENT_USER || "root"),
    password: (process.env.ORIENT_PASS || "root"),
});

/** @type {orientjs.Db} */
var db = undefined;

function initDatabase(dbs) {
   for (let found of dbs) {
        if (found.name == DB_NAME) {
            console.log("[Orient] Found Existing Orient Database:", found.name)
            initClasses(db = found);
            return;
        }
    }
    if (db == undefined) {
        server.create({
            name: DB_NAME,
            type: 'graph',
            storage: 'plocal'
        }).then(created => {
            console.log("[Orient] Created New Orient Database:", created.name)
            initClasses(db = created);
        })
    }
}

/**
 * 
 * @param {orientjs.ODatabase} database 
 */
function initClasses(database) {
    database.class.list().then(classes => {
        ensureClass(classes, CLASS_ALIAS_NAME, [
            { name: "id", type: "String"},
            { name: "name", type: "String"},
        ]);
        ensureClass(classes, CLASS_REALM_NAME, [
            { name: "id", type: "String"},
            { name: "name", type: "String"},
        ]);
    })
}

function ensureClass(classes, name, props) {
    for (let c of classes) {
        if (c.name == name) {
            console.log("[Orient] Found Existing Class:", name)
            return;
        }
    }
    db.class.create(name, "V").then(c => {
        console.log("[Orient] Created New Class:", c.name);
        c.property.create(props).then(p => {
            console.log(`[Orient] Created Properties for ${c.name}:`, p);
        });
    });
}

// Get our DB from Orient
server.list().then(initDatabase);

module.exports = {
    
    /**
     * Callback returning a list of all realms available to the FIM DB.
     *
     * @callback realmReturnCallback
     */
    /**
     * Retrieves every known alias for the given user ID / realm pair.
     * @param {realmReturnCallback} cb 
     */
    getRealms: function(cb) {

    },

    /**
     * Callback returning a master ID.
     *
     * @callback idReturnCallback
     * @param {string} id - The ID representing the user in your master FIM system.
     */
    /**
     * Retrieves the master alias for the given user ID / realm pair.
     * @param {string} id 
     * @param {string} realm 
     * @param {idReturnCallback} callback 
     */
    getMasterAlias: function(id, realm, callback) {
        
        let query = `
            select id from (
                select expand(out("AliasFor")) from (
                    select expand(in("BelongsTo")) from Realm where id = "${db.escape(realm)}"
                ) where id = "${db.escape(id)}"
            )
        `
        db.query(query).then(results => {
            if (results.length == 0)
                callback(null);
            else if (results.length == 1)
                callback(results[0].id);
            else {

                // This is problematic, but won't be if these are all the same...
                let id_ = results[0].id;
                for (let result in results) {
                    if (id_ != result.id) {
                        console.warn("[Orient] IMPROPER TABLE CONFIGURATION, MULTIPLE IDs FOR SAME USER ON SAME REALM");
                        break;
                    }
                }
                callback(id_);
            }
        });
    },
}
