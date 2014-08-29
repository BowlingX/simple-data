/*!
 * @overview Simple data layer for ember
 * @copyright Copyright (c) 2013-2014 David Heidrich
 * @author David Heidrich (me@bowlingx.com)
 *
 * @license Licensed under MIT License
 *          see: https://raw.github.com/BowlingX/simple-data/master/LICENSE
 */
(function (window, $, Ember) {
    "use strict";

    /**
     * Init SimpleData Object
     */
    if ('undefined' === typeof window.SD) {
        window.SD = {};
    }


    /**
     * A Mixin for serialization
     * @link http://byronsalau.com/blog/convert-ember-objects-to-json/
     * @type {*}
     */
    SD.Serializable = Ember.Mixin.create({
        serialize: function () {
            var result = {};
            for (var key in $.extend(true, {}, this)) {
                // Skip these
                if (key === 'isInstance' ||
                    key === 'isDestroyed' ||
                    key === 'isDestroying' ||
                    key === 'concatenatedProperties' ||
                    typeof this[key] === 'function') {
                    continue;
                }
                result[key] = this[key];

            }
            return result;
        }
    });

    /**
     * A Basic model that provides basic Caching algorithms
     * @type {*}
     */
    SD.Model = Ember.Object.extend(SD.Serializable, {

        /**
         * Reloads a record
         * @returns {*}
         */
        reload: function () {
            var $this = this;
            var data = this.constructor.reload(this);
            return data.then(function (r) {
                $this.replace(r);
                return $this;
            });
        },

        replace: function (data) {
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

        afterRemove: function () {
        }

    });
    /**
     * A Mixin that is applied when model is embedded into an array of parent Object
     * @type {*}
     */
    SD.ModelArrayHolderMixin = Ember.Mixin.create({
        _parent: null,
        _path: null,
        /**
         * A Reference to collection
         * @returns {*}
         */
        getArrayRef: function () {
            return SD.Model.findPath(this._parent, this._path);
        },
        /**
         * @returns parent element
         */
        getParent: function () {
            return this._parent;
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
        _parent: null,
        _path: null,
        add: function (thisRecord) {
            var $this = this;
            var addedRecord = thisRecord.constructor.add(thisRecord);
            return addedRecord.then(function (r) {
                var record = thisRecord.constructor.applyMappingForArray(r, $this._parent, $this._path);
                $this.addObject(record);
                return record;
            });
        },
        /**
         * Inserts a fully loaded record into collection at the beginning
         * @param idx index
         * @param data object
         */
        insertElementAt: function (idx, data, type) {
            var object = type.applyMappingForArray(data, this._parent, this._path);
            this.insertAt(idx, object);
            return object;
        },
        insertAfter: function (data, type) {
            var object = type.applyMappingForArray(data, this._parent, this._path);
            this.addObject(object);
            return object;
        }

    });


    SD.AdapterOperationsMixin = Ember.Mixin.create({

        /**
         * This creates a new Record
         * @param newRecord
         */
        add: function (newRecord) {
        },

        /**
         * Called when record.reload() ist called
         * @param oldRecord
         */
        reload: function (oldRecord) {
        },

        /**
         * Called when record.remove() is called
         * @param record
         */
        remove: function (record) {
        },

        /**
         * Called when Model.find(id) is called and record was not found in cache
         * Any number of arguments is allowed
         * @param id
         */
        findRecord: function (id) {
        }
    });

    /**
     * Static Methods for model
     */
    SD.Model.reopenClass(SD.AdapterOperationsMixin, {

        _cache: [],
        _mapping: {},

        /**
         * Will preload the data in a cache so find() method will ask the cache first
         * @param data either an object or an array
         */
        preload: function (data) {
            data = this.serialize(data);
            if (data instanceof Array) {
                this._cache[this] = data;
            } else {
                this._cache[this] = [];
                this._cache[this].push(data);
            }
        },

        serialize: function (payload) {
            return payload;
        },

        map: function (key, type) {
            if (!this._mapping[this]) {
                this._mapping[this] = {}
            }
            this._mapping[this][key] = type;
            return this;
        },
        /**
         * Executed if path is an Object
         * Will apply any mapping that is defined for this Model
         * @param object
         */
        applyMapping: function (object) {
            // Create a Model of root Object (found Model)
            var appliedModel = (object instanceof this) ? object : this.create(object);
            // Now Apply mapping defined on this model to describe more models on this path
            // Valid mappings:
            // App.Model.map("object.path", App.MyModel)
            var $this = this;
            return object instanceof Array ? SD.ModelArrayHolder.create(
                {_parent: appliedModel, _path: "this", content: object.map(function (item) {
                    return $this.applyMappingForArray(item, appliedModel, "this");
                })}) : this._applyMapping(appliedModel);

        },
        /**
         * Applys mapping to Model
         * @param appliedModel
         * @returns {*}
         * @private
         */
        _applyMapping: function (appliedModel) {
            var $this = this;
            for (var prop in this._mapping[this]) {
                if (this._mapping[this].hasOwnProperty(prop)) {
                    var model = this._mapping[this][prop];
                    $this._deepFindAndApply(appliedModel, prop, model)
                }
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
            if (typeof current === 'object') {
                var value = current instanceof Array ? SD.ModelArrayHolder.create(
                    {_parent: obj, _path: path, content: current.map(function (item) {
                        return model.applyMappingForArray(item, obj, path);
                    })}) : model.applyMapping(current);
            }

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
            if (!this._cache[this]) {
                this._cache[this] = [];
            }
            var object = this._cache[this].find(function (item) {
                if (id === undefined) {
                    return item;
                }
                return item.id && item.id === id;
            });
            if (object) {
                return def.resolve(this.applyMapping(object)).promise();
            } else {
                var $this = this;
                return this.findRecord.apply(this, arguments).then(function (result) {
                    return $this.applyMapping(result);
                });
            }
        },
        /**
         * Invalidates cache
         */
        invalidateCache: function () {
            this._cache[this] = [];
        }

    });

})(window, jQuery, Ember);


