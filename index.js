;(function(root) {
  "use strict";

  var hasOwn = Object.prototype.hasOwnProperty;

  // check if an object is empty (has no iterable keys)
  function isEmpty(obj) {
    for (var key in obj) {
      return false;
    }
    return true;
  }

  // logarithmic string repeat
  function repeat(str, count) {
    var out = '';
    while (count > 0) {
      if ((count & 1) === 1) {
        out += str;
      }
      str += str;
      count >>= 1;
    }
    return out;
  }

  function defaultTokenizer(path) {
    // delimit by slashes, counting duplicate slashes as singular
    return path.split(/\/+/g);
  }

  // TODO: put this in a custom error constructor?
  // concerns: cross-platform support
  function routeError(route) {
    var err = new Error("route conflicts with existing route " + route);
    err.route = route;
    return err;
  }

  function Node() {
    this.order = 0;
    this.route = null;
    this.matchData = null;
    this.vars = null;

    this.children = null;
  }

  function Router(tokenizer) {
    this.root = new Node();
    this.tokenizer = tokenizer || defaultTokenizer;
    this.routes = 0;
  }

  Router.prototype.list = function() {
    var routes = [];

    function search(node) {
      if (node.route) {
        routes.push(node.route);
      }
      var children = node.children;
      for (var part in children) {
        search(children[part]);
      }
    }

    search(this.root);

    return routes;
  };

  Router.prototype.add = function(path, matchData) {
    var pathParts = this.tokenizer(path), vars = [];
    var node = this.root, next = null;

    for (var i = 0, n = pathParts.length; i < n; i++) {
      var part = pathParts[i];

      if (part.charAt(0) === ':') {
        vars.push(part.slice(1));
        part = '*';
      }

      if (!node.children) {
        node.children = {};
      }

      next = node.children[part];
      if (next) {
        node = next;
      } else {
        next = new Node();
        node.children[part] = next;
        node = next;
      }
    }

    if (node.route) {
      throw routeError(node.route);
    }

    node.order = ++this.routes;
    node.route = path;
    node.matchData = matchData;

    if (vars.length > 0) {
      node.vars = vars;
    }
  };

  Router.prototype.remove = function(path) {
    var pathParts = this.tokenizer(path);
    var node = this.root;

    var nodes = new Array(pathParts.length);
    for (var i = 0, n = pathParts.length; i < n; i++) {
      var part = pathParts[i];

      if (node.children && hasOwn.call(node.children, part)) {
        nodes[i] = {
          node: node,
          part: part
        };
        node = node.children[part];
      } else if (node.children && node.children['*']) {
        nodes[i] = {
          node: node,
          part: '*'
        };
        node = node.children['*'];
      } else {
        // no matching nodes
        return;
      }
    }

    // delete the matching leaf node
    for (i = nodes.length - 1; i >= 0; i--) {
      var n = nodes[i], children = n.node.children;
      if (children[n.part] === node) {
        // delete the leaf node
        delete children[n.part];
      } else if (isEmpty(children[n.part].children)) {
        delete children[n.part];
      } else {
        break;
      }
    }
  };

  Router.prototype.toString = function(node) {
    node || (node = this.root);

    function string(node, depth) {
      var children = node.children, str = '', pad = repeat('\t', depth++);

      for (var part in children) {
        var next = children[part];
        str += pad + part
          + (next.vars ? ' ' + JSON.stringify(next.vars) : '') + '\n'
          + string(children[part], depth);
      }

      return str;
    }

    return string(node, 0);
  };

  Router.prototype.resolve = function(path) {
    var pathParts = this.tokenizer(path);

    var bestQuality = -1, bestOrder = Infinity, bestNode = null, bestVals = null;

    // find the best possible match by recursively following best matches
    function follow(node, parts, offset, vals, quality) {
      if (offset < parts.length) {
        var part = parts[offset++];

        var children = node.children;
        if (children) {
          if (hasOwn.call(children, part)) {
            // follow node roots, add one to the quality for exact match
            follow(children[part], parts, offset, vals, quality + 1);
          }
          if (children['*']) {
            var subvals = vals.slice();
            subvals.push(part);
            // follow node roots, but leave quality for wildcard
            follow(children['*'], parts, offset, subvals, quality);
          }
        }
      } else if (node.route) {
        // calculate best match as we go
        if (quality > bestQuality ||
           (quality === bestQuality && node.order < bestOrder)) {
          bestQuality = quality;
          bestOrder = node.order;
          bestNode = node;
          bestVals = vals;
        /* istanbul ignore next: logically unreachable */
        } else if (quality === bestQuality && node.order === bestOrder) {
          throw new Error('indeterminate route match between ' +
            bestMatch.node.route + ' and ' + node.route);
        }
      }
    }

    follow(this.root, pathParts, 0, [], 0);

    if (!bestNode) {
      return null;
    }

    var params = {}, vars = bestNode.vars;
    for (var i = 0, n = bestVals.length; i < n; i++) {
      params[vars[i]] = bestVals[i];
    }

    var data = bestNode.matchData;

    if (typeof data === 'function') {
      data(bestNode.route, params);
      data = undefined;
    }

    return {
      route: bestNode.route,
      params: params,
      data: data
    };
  };

  /* istanbul ignore next: not relevant */
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined') {
      exports = module.exports = Router;
    }
    exports.Router = Router;
  } else {
    var previousRouter = root.Router;

    root.Router = Router;

    Router.noConflict = function() {
      root.Router = previousRouter;
    };
  }
})(this);
