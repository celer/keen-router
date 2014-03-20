# Keen Router


## Introduction

This is a path router for use with your favorite web framework. 

It is a bit special because:
  
  * It uses a tree based structure to store routes, it doesn't use a list like most popular routers
    * It will use as few comparisons as possible to determine if a path is matched
  * It can disambiguate between multiple conflicting routes, and will choose the best one

#### Code Coverage

* Statements   : 95.03% ( 153/161 )
* Branches     : 84.85% ( 56/66 )
* Functions    : 100% ( 9/9 )
* Lines        : 95% ( 152/160 )

## Routing logic

Routes are stored in a tree structure, so the moment a path element doesn't match we
stop comparing routes. So let's imagine the following routes, in our router:

  * /foo/bar
  * /foo/:param
  * /foo/:param/bar
  * /foo/:param/baz

A tree structure like so is created in the router:

  * foo
    * bar
    * :param
      * bar
      * baz
  
It uses a depth first search upon a tree to match routes, branching the search when 
multiple possible routes are encountered. It should perform better then a router 
which uses a linear search method, especially when there are many branches in the
route. But the primary value isn't speed, it is the ability to disambiguate between
multiple conflicting routes.  

The router will prefer exact path element matches over parameter matches, but 
will still consider the parameter matches. 

So in the case where we would have multiple possible matches:
 
  * /a/:1/:3/:4 
  * /:1/b/:2/:3
  * /:1/:2/c/:3
  * /:1/:2/:3/d

where a path like:
  
  /a/b/c/d

Could match any of the above paths, the router will choose the route which 
was added first.  

## Examples

Here is a very simplistic example, where we define multiple routes

```javascript
  var Router = require('keen-router');

  var r = new Router();

  r.add("/user");
  r.add("/account");
  r.add("/mailbox");
  r.add("/user/:id");

  r.resolve("/user"); // returns { route:"/user", params:{}});
  r.resolve("/user/55"); // returns { route:"/user/:id", params:{id:"55"}});

  //Later we could decide to remove a route:
  r.remove("/user");
  
```

Here is an example which uses call backs:

```javascript
  var Router = require('keen-router');

  var r = new Router();
  
  // the :bar is a parameter and will be put into the params hash
  r.add("/foo/:bar",function(route,params){
    //route would contain the route if matched, i.e. /foo/:bar
    //params would contain the matched parameters, i.e. { bar:"bar"}
  });

  r.resolve("/foo/bar");
```  

You can also specify your own tokenizer for routes:

```javascript
  
  var Router = require('keen-router');

  var r = new Router(function(path){
    return path.split("|");
  });

```

This means that you can support routes in various formats such as:

> METHOD HOSTNAME PATH

such as

> GET foo.com /user



