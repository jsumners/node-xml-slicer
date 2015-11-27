'use strict';
interface Options {
    textAttrName?: string;
    attrNameMutator?: (input: string) => string;
    propNameMutator?: (input: string) => string;
    valueMutator?: (input: any) => any;
}

// @target: ES6
// @module: commonjs
export default class Slicer {
    private location = [];
    private rootPath;
    private withinPath: boolean = false;
    public errors: string[] = null;
    private nodeInfo = {};
    private objectStack = [];
    private result_;
    private slicer;

    private options: Options;
    private hasPropertyNameMutator: boolean = false;

    constructor(parser, rootPath?: string, options?: Options) {
        this.rootPath = (rootPath || '').split('/').filter(i => { return !!i; });
        if (!this.rootPath.length) {
            this.rootPath = ['*'];
        }

        this.options = {
            textAttrName: '#',
            attrNameMutator: (input) => { return input; },
            valueMutator: (input) => { return input }
        };
        this.options = Object.assign(this.options, options || {});
        this.hasPropertyNameMutator = this.options.propNameMutator !== undefined;

        parser.slicer = this;
        this.slicer = this;
        parser.on('startElement', (name, attrs) => {
            var t = this.slicer;

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

        parser.on('endElement', name => {
            var t = this.slicer;

            t.checkExitPath();
            t.location.pop();

            if (t.withinPath) {
                var nodeInfo = t.objectStack.pop();
                var justWhitespace = /^\s+$/;

                if (nodeInfo.attrs) {
                    if (!nodeInfo.result) {
                        nodeInfo.result = {};
                        if (!justWhitespace.test(nodeInfo.text)) {
                            nodeInfo.result[this.options.textAttrName] =
                                this.options.valueMutator(nodeInfo.text);
                        }
                    }

                    for (var i in nodeInfo.attrs) {
                        if (nodeInfo.attrs.hasOwnProperty(i)) {
                            nodeInfo.result[i] =
                                this.options.valueMutator(nodeInfo.attrs[i]);
                        }
                    }
                }

                var parentNodeInfo = t.objectStack[t.objectStack.length - 1];
                if (!parentNodeInfo.result) {
                    parentNodeInfo.result = {};
                }

                if (parentNodeInfo.text && !justWhitespace.test(parentNodeInfo.text)) {
                    parentNodeInfo.result[this.options.textAttrName] = parentNodeInfo.text.trim();
                }

                if (parentNodeInfo.result[nodeInfo.name]) {
                    // make array

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

        parser.on('text', text => {
            var t = this.slicer;
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

        parser.on('error', error => {
            if (!this.slicer.errors) {
                this.slicer.errors = [];
            }
            this.slicer.errors.push('Error parsing XML: ' + error);
            this.withinPath = false;
        });
    }

    get result() {
        if (this.result_ === undefined) {
            if (this.errors || this.objectStack.length === 0) {
                this.result_ = null;
            } else if (this.objectStack.length === 1) {
                this.result_ = {};
                this.result_[this.objectStack[0].name] = this.itemResult(this.objectStack[0]);
            } else {
                this.result_ = {};
                this.objectStack.forEach(item => {
                    if (this.result_[item.name]) {
                        if (!Array.isArray(this.result_[item.name])) {
                            this.result_[item.name] = [this.result_[item.name]];
                        }

                        this.result_[item.name].push(this.itemResult(item));
                    } else {
                        this.result_[item.name] = this.itemResult(item);
                    }
                });
            }

            // After building the result object, re-map the property names
            if (this.hasPropertyNameMutator && this.result_) {
                var propMutator = this.options.propNameMutator;
                function typof(val) {
                    var str = Object.prototype.toString.call(val);
                    return str
                        .substring(str.indexOf(" ") + 1, str.length - 1)
                        .toLowerCase();
                }

                function remap(obj: Object) {
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
                }
                this.result_ = remap(this.result_);
            }
        }

        return this.result_;
    }

    private itemResult(item) {
        if (item.result) {
            return item.result;
        } else {
            if (item.attrs) {
                var result = {};
                result[this.options.textAttrName] =
                    this.options.valueMutator(item.text);
                for (var i in item.attrs) {
                    if (item.attrs.hasOwnProperty(i)) {
                        result[this.options.attrNameMutator(i)] =
                            this.options.valueMutator(item.attrs[i]);
                    }
                }
                return result;
            } else {
                return this.options.valueMutator(item.text);
            }
        }
    }

    private checkEnterPath() {
        if (this.withinPath || this.location.length !== this.rootPath.length) {
            return;
        }

        this.withinPath = !this.errors &&
            this.rootPath.every((u, i) => { return u === this.location[i] || u === '*'; });
    }

    private checkExitPath() {
        if (this.withinPath && this.location.length === this.rootPath.length) {
            this.withinPath = false;
        }
    }
}