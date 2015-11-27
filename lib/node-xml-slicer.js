'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

Object.defineProperty(exports, "__esModule", {
    value: true
});

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Slicer = (function () {
    function Slicer(parser, rootPath, options) {
        var _this = this;

        _classCallCheck(this, Slicer);

        this.location = [];
        this.withinPath = false;
        this.errors = null;
        this.nodeInfo = {};
        this.objectStack = [];
        this.hasPropertyNameMutator = false;
        this.rootPath = (rootPath || '').split('/').filter(function (i) {
            return !!i;
        });
        if (!this.rootPath.length) {
            this.rootPath = ['*'];
        }
        this.options = {
            textAttrName: '#',
            attrNameMutator: function attrNameMutator(input) {
                return input;
            },
            valueMutator: function valueMutator(input) {
                return input;
            }
        };
        this.options = Object.assign(this.options, options || {});
        this.hasPropertyNameMutator = this.options.propNameMutator !== undefined;
        parser.slicer = this;
        this.slicer = this;
        parser.on('startElement', function (name, attrs) {
            var t = _this.slicer;
            t.location.push(name);
            t.checkEnterPath();
            if (t.withinPath) {
                t.nodeInfo = { name: name };
                var hasAttrs = false;
                for (var i in attrs) {
                    if (attrs.hasOwnProperty(i)) {
                        hasAttrs = true;
                        break;
                    }
                }
                if (hasAttrs) {
                    t.nodeInfo.attrs = attrs;
                }
                t.objectStack.push(t.nodeInfo);
            }
        });
        parser.on('endElement', function (name) {
            var t = _this.slicer;
            t.checkExitPath();
            t.location.pop();
            if (t.withinPath) {
                var nodeInfo = t.objectStack.pop();
                var justWhitespace = /^\s+$/;
                if (nodeInfo.attrs) {
                    if (!nodeInfo.result) {
                        nodeInfo.result = {};
                        if (!justWhitespace.test(nodeInfo.text)) {
                            nodeInfo.result[_this.options.textAttrName] = _this.options.valueMutator(nodeInfo.text);
                        }
                    }
                    for (var i in nodeInfo.attrs) {
                        if (nodeInfo.attrs.hasOwnProperty(i)) {
                            nodeInfo.result[i] = _this.options.valueMutator(nodeInfo.attrs[i]);
                        }
                    }
                }
                var parentNodeInfo = t.objectStack[t.objectStack.length - 1];
                if (!parentNodeInfo.result) {
                    parentNodeInfo.result = {};
                }
                if (parentNodeInfo.text && !justWhitespace.test(parentNodeInfo.text)) {
                    parentNodeInfo.result[_this.options.textAttrName] = parentNodeInfo.text.trim();
                }
                if (parentNodeInfo.result[nodeInfo.name]) {
                    if (!Array.isArray(parentNodeInfo.result[nodeInfo.name])) {
                        parentNodeInfo.result[nodeInfo.name] = [parentNodeInfo.result[nodeInfo.name]];
                    }
                    if (nodeInfo.result) {
                        parentNodeInfo.result[nodeInfo.name].push(nodeInfo.result);
                    } else {
                        parentNodeInfo.result[nodeInfo.name].push(nodeInfo.text || null);
                    }
                } else {
                    if (nodeInfo.result) {
                        parentNodeInfo.result[nodeInfo.name] = nodeInfo.result;
                    } else {
                        parentNodeInfo.result[nodeInfo.name] = nodeInfo.text || null;
                    }
                }
            }
        });
        parser.on('text', function (text) {
            var t = _this.slicer;
            if (t.withinPath) {
                text = text.replace(/^ +$/, '');
                if (text) {
                    if (!t.nodeInfo.text) {
                        t.nodeInfo.text = text;
                    } else {
                        t.nodeInfo.text += text;
                    }
                }
            }
        });
        parser.on('error', function (error) {
            if (!_this.slicer.errors) {
                _this.slicer.errors = [];
            }
            _this.slicer.errors.push('Error parsing XML: ' + error);
            _this.withinPath = false;
        });
    }

    _createClass(Slicer, [{
        key: 'itemResult',
        value: function itemResult(item) {
            if (item.result) {
                return item.result;
            } else {
                if (item.attrs) {
                    var result = {};
                    result[this.options.textAttrName] = this.options.valueMutator(item.text);
                    for (var i in item.attrs) {
                        if (item.attrs.hasOwnProperty(i)) {
                            result[this.options.attrNameMutator(i)] = this.options.valueMutator(item.attrs[i]);
                        }
                    }
                    return result;
                } else {
                    return this.options.valueMutator(item.text);
                }
            }
        }
    }, {
        key: 'checkEnterPath',
        value: function checkEnterPath() {
            var _this2 = this;

            if (this.withinPath || this.location.length !== this.rootPath.length) {
                return;
            }
            this.withinPath = !this.errors && this.rootPath.every(function (u, i) {
                return u === _this2.location[i] || u === '*';
            });
        }
    }, {
        key: 'checkExitPath',
        value: function checkExitPath() {
            if (this.withinPath && this.location.length === this.rootPath.length) {
                this.withinPath = false;
            }
        }
    }, {
        key: 'result',
        get: function get() {
            var _this3 = this;

            if (this.result_ === undefined) {
                if (this.errors || this.objectStack.length === 0) {
                    this.result_ = null;
                } else if (this.objectStack.length === 1) {
                    this.result_ = {};
                    this.result_[this.objectStack[0].name] = this.itemResult(this.objectStack[0]);
                } else {
                    this.result_ = {};
                    this.objectStack.forEach(function (item) {
                        if (_this3.result_[item.name]) {
                            if (!Array.isArray(_this3.result_[item.name])) {
                                _this3.result_[item.name] = [_this3.result_[item.name]];
                            }
                            _this3.result_[item.name].push(_this3.itemResult(item));
                        } else {
                            _this3.result_[item.name] = _this3.itemResult(item);
                        }
                    });
                }
                if (this.hasPropertyNameMutator && this.result_) {
                    var propMutator;

                    (function () {
                        var typof = function typof(val) {
                            var str = Object.prototype.toString.call(val);
                            return str.substring(str.indexOf(" ") + 1, str.length - 1).toLowerCase();
                        };

                        var remap = function remap(obj) {
                            var result = {};
                            var keys = Object.keys(obj);
                            var i, j;
                            for (i = 0; i < keys.length; i += 1) {
                                var value = obj[keys[i]];
                                var _key = propMutator(keys[i]);
                                result[_key] = value;
                                if (typof(value) === "object") {
                                    result[_key] = remap(value);
                                }
                                if (typof(value) === "array") {
                                    result[_key] = [];
                                    for (j = 0; j < value.length; j += 1) {
                                        if (typof(value[j]) === "object") {
                                            result[_key].push(remap(value[j]));
                                        } else {
                                            result[_key].push(value[j]);
                                        }
                                    }
                                }
                            }
                            return result;
                        };

                        propMutator = _this3.options.propNameMutator;

                        _this3.result_ = remap(_this3.result_);
                    })();
                }
            }
            return this.result_;
        }
    }]);

    return Slicer;
})();

exports.default = Slicer;
module.exports = exports['default'];
//# sourceMappingURL=node-xml-slicer.js.map
