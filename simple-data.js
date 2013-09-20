/*!
 * Simple data layer for ember
 * Copyright (c) 2013 David Heidrich
 * @author David Heidrich (me@bowlingx.com)
 */

SD = {};


/**
 * A Basic model
 * @type {*}
 */
SD.Model = Ember.Object.extend({

    /**
     * Reloads a record
     * @returns {*}
     */
    reload: function () {
        var $this = this;
        var data = this.constructor.reload(this);
        return data.then(function(r){
            $this.replace(r);
            return $this;
        });
    },

    replace:function(data) {
      var newModel = this.constructor.applyMapping(data);
      this.setProperties(newModel);
    },

    /**
     * Removes a record
     * @returns {*}
     */
    remove: function () {
        var removed = this.constructor.remove(this);
        var $this = this;
        return removed.then(function () {
            $this.afterRemove();
            return $this;
        });

    },

    afterRemove: function () { }

});
/**
 * A Mixin that is applied when model is embedded into an array of parent Object
 * @type {*}
 */
SD.ModelArrayHolderMixin = Ember.Mixin.create({
    _parent: null,
    _path: null,

    getArrayRef: function () {
        return SD.Model.findPath(this._parent, this._path);
    },
    /**
     * Removes element from parent array
     * @returns {*}
     */
    removeFromArray: function () {
        return this.getArrayRef().removeObject(this);
    },
    afterRemove: function () {
        this._super();
        this.removeFromArray();
    }
});


/**
 * Holds Collection of Models
 * @type {*}
 */
SD.ModelArrayHolder = Ember.ArrayProxy.extend({
    _parent:null,
    _path:null,
    appendRecord: function (thisRecord) {
        var $this = this;
        var addedRecord = thisRecord.constructor.add(thisRecord);
        return addedRecord.then(function (r) {
            var record = thisRecord.constructor.applyMappingForArray(r, $this._parent, $this._path);
            $this.addObject(record);
            return record;
        });
    }
});

/**
 * Static Methods for model
 */
SD.Model.reopenClass({

    _cache: [],
    _mapping: {},

    /**
     * Will preload the data in a cache so find() method will ask the cache first
     * @param data either an object or an array
     */
    preload: function (data) {
        data = this.serialize(data);
        if (data instanceof Array) {
            this._cache = data;
        } else {
            this._cache.push(data);
        }
    },

    serialize: function (payload) {
        return payload;
    },

    map: function (key, type) {
        this._mapping[key] = type;
        return this;
    },
    /**
     * Executed if path is an Object
     * Will apply any mapping that is defined for this Model
     * @param object
     */
    applyMapping: function (object) {
        // Create a Model of root Object (found Model)
        var appliedModel = this.create(object);
        // Now Apply mapping defined on this model to describe more models on this path
        // Valid mappings:
        // App.Model.map("object.path", App.MyModel)

        return this._applyMapping(appliedModel);
    },
    /**
     * Applys mapping to Model
     * @param appliedModel
     * @returns {*}
     * @private
     */
    _applyMapping: function (appliedModel) {
        var $this = this;
        for (var prop in this._mapping) {
            var model = this._mapping[prop];
            $this._deepFindAndApply(appliedModel, prop, model)
        }
        return appliedModel;
    },
    /**
     * Executed if path is an array
     * @param object
     * @param p
     * @param path
     * @returns {*}
     */
    applyMappingForArray: function (object, p, path) {
        var applied = this.createWithMixins(object, SD.ModelArrayHolderMixin);
        applied.set('_parent', p);
        applied.set('_path', path);
        return this._applyMapping(applied);
    },
    /**
     * Finds an object by path
     * @param obj
     * @param path
     * @returns {*}
     */
    findPath: function (obj, path) {
        var paths = path.split('.'), current = obj , i;

        for (i = 0; i < paths.length; ++i) {
            if (current[paths[i]] == undefined) {
                return undefined;
            } else {
                current = current[paths[i]];
            }
        }
        return current;
    },
    /**
     * Finds an Object, applies mapping and apply changes to object
     * @param obj
     * @param path
     * @param model
     * @returns {*}
     * @private
     */
    _deepFindAndApply: function (obj, path, model) {
        var current = this.findPath(obj, path);
        if (!current) {
            return;
        }

        var value = current instanceof Array ? SD.ModelArrayHolder.create(
            {_parent:obj, _path:path, content: current.map(function (item) {
                return model.applyMappingForArray(item, obj, path);
            })}) : model.applyMapping(current);

        this._setObjectPathToValue(obj, value, path);

        return obj;
    },
    /**
     * Sets an object graph
     * @param obj object to modify
     * @param value value to set
     * @param path path to modify
     * @private
     */
    _setObjectPathToValue: function (obj, value, path) {
        var paths = path.split('.'),
            parent = obj;

        for (var i = 0; i < paths.length - 1; i += 1) {
            parent = parent[paths[i]];
        }

        parent[paths[paths.length - 1]] = value;
    },
    /**
     * Will find an item by ID
     * @param id
     * @returns promise
     */
    find: function (id) {
        var def = $.Deferred();
        var object = this._cache.find(function (item) {
            return item.id && item.id === id;
        });
        if (object) {
            return def.resolve(this.applyMapping(object)).promise();
        } else {
            return $.get()
        }
    },

    add: function (o) {},
    reload:function(oldRecord){}

});
