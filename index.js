"use strict";

//If we're using Node.JS then lets do a bunch of assertions
if(typeof require=="function"){
  var assert = require('assert');
}


var Router=function(tokenizer){
  this.root={};
  this.tokenizer=tokenizer||function(path){
    //remove any duplicate slashes, this seems to be common practice
    path=path.replace(/\/+/g,"/");
    return path.split("/");
  };
  this.routes=0;
}

Router.prototype.list=function(){
  var routes = [];

  var search=function(node){
    if(node.route){
      routes.push(node.route);
    }
    for(var i in node.children){
      search(node.children[i]);
    }
  }
   

  search(this.root);

  return routes;

}

Router.prototype.add=function(path,onMatch){
  var pathParts = this.tokenizer(path);
  var node = this.root;
  var vars = [];

  this.routes++;


  var part = null;
  while(pathParts.length>0){
    part = pathParts.shift();

    if(/^:/.test(part)){
      vars.push(part.slice(1));
      part = "*";
    }
 
    if(!node.children) node.children={};

    if(!node.children[part]){
      node.children[part]={};
    }   
    node=node.children[part];
  } 
  
 
  if(node.route){
    var e = new Error("This route conflicts with an existing route:"+node.route);
    e.route=node.route;
    throw e;
  }

  node.order=this.routes;
  
  node.onMatch = onMatch; 
  node.route=path;
  if(vars.length>0)
    node.vars=vars; 
}

Router.prototype.remove=function(path){
  var pathParts = this.tokenizer(path);
  var node = this.root;
  
  var nodes = [];
  while(pathParts.length>0){
    var part = pathParts.shift();

    if(node.children && node.children[part]){
      nodes.push({ node: node, part: part });
      node = node.children[part];
    } else if(node.children && node.children["*"]){
      nodes.push({ node: node, part: "*" });
      node = node.children["*"];
    } else {
      node=null;
      break;
    } 
  } 

  //Ok so now we have a matching leaf node .. we can delete it 
  if(node){
    while(nodes.length>0){
      var n = nodes.pop();
      //If this is the leaf node delete it
      if(n.node.children[n.part]==node){
        delete n.node.children[n.part];
      } else if(Object.keys(n.node.children[n.part].children).length==0){
          delete n.node.children[n.part];
      } else {
        break;
      }
    } 
  }

}

Router.prototype.toString=function(node,depth){
  var depth=depth||0;
  var node = node||this.root;

  var str=""; 

  var s = "";

  for(var ts = 0; ts < depth ; ts++)
    s+="\t";


  for(var i in node.children){
    var n = node.children[i];
    str+=s+i+(n.vars?" "+JSON.stringify(n.vars):"")+"\n";
    str+=this.toString(node.children[i],depth+1); 
  }
  return str;
}

Router.prototype.resolve=function(path){
  var pathParts = this.tokenizer(path);

  var node = this.root;
  
  var vals = [];

  var incompleteNode=null;
  var lastMatch = null;

  var matches = [];

  /*
    This will attempt to find the best match possible
    by recursively following any possible matches
  */ 
  var follow=function(node,parts,vals,quality){
    parts = parts.slice(0);
    vals = vals.slice(0);
    if(parts.length>0){
      var part = parts.shift();
      
      if(node.children){
        if(node.children[part]){  
          //Follow these node roots, add one to the quality because
          // they were an exact match
          follow(node.children[part],parts,vals,quality+1);
        } 
        if(node.children["*"]){
          vals.push(part);
          //Follow these node roots, but keep the quality the same
          // because they are based on a wildcard match
          follow(node.children["*"],parts,vals,quality);
        }
      }
    } else {
      if(node.route){
        matches.push({node: node, vals: vals, quality:quality});
      }
    }
  }

  follow(this.root,pathParts,[],0);

  if(matches.length>0){
    if(matches.length>1){
      matches=matches.sort(function(a,b){
        if(a.quality>b.quality)
          return -1;
        else if(a.quality<b.quality)
          return 1;
        else { 
          //Ok so the qualities matches, now we'll look at order of insertion
          if(a.node.order < b.node.order)
            return -1;
          if(a.node.order > b.node.order) 
            return 1;
          else throw new Error("Indeterminate route match between:"+a.node.route+" and "+b.node.route);
  
        };
      });
    }
    node = matches[0].node;
    vals = matches[0].vals;

    //We matched all of the path!
    if(node && node.route){
      var params = {};
      for(var i in vals){
        params[node.vars[i]]=vals[i]; 
      }
      if(typeof node.onMatch=="function"){
        node.onMatch(node.route,params);
      } 
      var res={ route: node.route, params: params };
      if(["array","number","string","object"].indexOf(typeof node.onMatch)!=-1){
        res.data=node.onMatch; 
      }
      return res;
    }
  }
}

if(typeof assert!="undefined"){

  var r = new Router();

  r.add("/1/2/3/4"); 
  
  assert.equal(r.toString(),"\n\t1\n\t\t2\n\t\t\t3\n\t\t\t\t4\n");
  
  try { 
    r.add("/1/2/3/4"); 
  } catch(e){
    assert.equal(e.toString(),"Error: This route conflicts with an existing route:/1/2/3/4");
  }
  
  r.add("1/2/3/4");

  assert.deepEqual(r.list(),["1/2/3/4","/1/2/3/4"]);


  assert.deepEqual(r.resolve("1/2/3/4"),{"route":"1/2/3/4","params":{}});
  assert.deepEqual(r.resolve("/1/2/3/4"),{"route":"/1/2/3/4","params":{}});
  assert.deepEqual(r.resolve("1/2/3/4/"),undefined);
 
  r.add("/foo/bin",function(route,params){  
    assert.equal(route,"/foo/bin");
  }); 

  r.resolve("/foo/bin");
 
  r.add("1/2/3/4/");
  assert.deepEqual(r.resolve("1/2/3/4/"),{"route":"1/2/3/4/","params":{}});

  r.add("/foo/:bar/baz");

  assert.deepEqual(r.resolve("/foo/wolf/baz"),{route:"/foo/:bar/baz",params:{bar:"wolf"}});
  assert.deepEqual(r.resolve("/foo/wolf/"),undefined);
  assert.deepEqual(r.resolve("/foo//baz"),undefined);
  assert.deepEqual(r.resolve("foo/wolf/baz"),undefined);

  //Now let's add a path which is more exact
  // but would conflict with the path above
  r.add("/foo/wolf/baz");

  assert.deepEqual(r.resolve("/foo/wolf/baz"),{route:"/foo/wolf/baz",params:{}});
  assert.deepEqual(r.resolve("/foo/car/baz"),{route:"/foo/:bar/baz",params:{bar:"car"}});

  r.add("/:biz/wolf/baz");  

  //It should match the most exact path it can
  assert.deepEqual(r.resolve("/foo/wolf/baz"),{route:"/foo/wolf/baz",params:{}});
  //It should match the most exact path it can
  assert.deepEqual(r.resolve("/car/wolf/baz"),{route:"/:biz/wolf/baz",params:{ biz:"car"}});

  //If we have a bunch of possible matches, it will match the one that appears first:
  r.add("/:1/a/:3/:4/wolf");
  r.add("/:1/:2/b/:4/wolf");
 
  assert.deepEqual(r.resolve("/wolf/a/b/c/wolf"),{route:"/:1/a/:3/:4/wolf", params:{ 1:"wolf", 3:"b", 4:"c"}}); 
   
  r.remove("/:1/a/:3/:4/wolf");
  
  assert.deepEqual(r.resolve("/wolf/a/b/c/wolf"),{"route":"/:1/:2/b/:4/wolf","params":{"1":"wolf","2":"a","4":"c"}}); 

  r.remove("/:1/:2/b/:4/wolf");
  assert.deepEqual(r.resolve("/wolf/a/b/c/wolf"),undefined);

  r.remove("/:biz/wolf/baz");  
  
  assert.deepEqual(r.resolve("/foo/wolf/baz"),{route:"/foo/wolf/baz",params:{}});
  //It should match the most exact path it can
  assert.deepEqual(r.resolve("/car/wolf/baz"),undefined);
  
  r.remove("/foo/wolf/baz");
  
  assert.deepEqual(r.resolve("/foo/wolf/baz"),{route:"/foo/:bar/baz",params:{bar:"wolf"}});
  
  r.remove("/foo/:bar/baz");
  assert.deepEqual(r.resolve("/foo/wolf/baz"),undefined);
  
  r.remove("/foo/:bar/baz");

  r.remove("1/2/3/4/");
  r.remove("1/2/3/4");
  r.remove("/1/2/3/4");

  r.remove("/foo/bin");

  assert.equal(r.toString(),"");

  r.add("/foo/:param/bar", { a: 1 });
  r.add("/foo/:param/baz");

  assert.deepEqual(r.resolve("/foo/1/bar"),{"route":"/foo/:param/bar","params":{"param":"1"}, data:{a:1}});
  assert.deepEqual(r.resolve("/foo/1/baz"),{"route":"/foo/:param/baz","params":{"param":"1"}});


  
}

if(typeof module!="undefined"){
  module.exports=Router;
}



