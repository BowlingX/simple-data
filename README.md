simple-data
===========

A very simple data wrapper for ember


Usage
=====

```javascript

// Define Model, no need to set any properties
App.MyModel = SD.Model.extend({});

App.OtherModel = SD.Model.extend({});

// Map objects or arrays to other models simply by using dot notation
App.Community.map('otherModelsProperty', App.OtherModel);

```