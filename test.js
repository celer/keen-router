var Router = require('./');
var assert = require('assert');

describe('Router', function() {
  it('should route', function() {
    var r = new Router();

    r.add('/1/2/3/4');

    assert.equal(r.toString(), '\n\t1\n\t\t2\n\t\t\t3\n\t\t\t\t4\n');

    try {
      r.add('/1/2/3/4');
    } catch(err) {
      assert.equal(err.toString(), 'Error: route conflicts with existing route /1/2/3/4');
    }

    r.add('1/2/3/4');

    assert.deepEqual(r.list(), ['1/2/3/4', '/1/2/3/4']);

    assert.deepEqual(r.resolve('1/2/3/4'), {route: '1/2/3/4', params: {}, data: undefined});
    assert.deepEqual(r.resolve('/1/2/3/4'), {route: '/1/2/3/4', params: {}, data: undefined});
    assert.deepEqual(r.resolve('1/2/3/4/'), null);

    var called = false;
    r.add('/foo/bin', function(route, params) {
      called = true;
      assert.equal(route, '/foo/bin');
    });

    r.resolve('/foo/bin');
    assert.ok(called);

    r.add('1/2/3/4/');
    assert.deepEqual(r.resolve('1/2/3/4/'), {route: '1/2/3/4/', params: {}, data: undefined});

    r.add('/foo/:bar/baz');

    assert.deepEqual(r.resolve('/foo/wolf/baz'), {route: '/foo/:bar/baz', params: {bar: 'wolf'}, data: undefined});
    assert.deepEqual(r.resolve('/foo/wolf/'), null);
    assert.deepEqual(r.resolve('/foo//baz'), null);
    assert.deepEqual(r.resolve('foo/wolf/baz'), null);

    // now let's add a more exact path that conflicts with the path above
    r.add('/foo/wolf/baz');

    assert.deepEqual(r.resolve('/foo/wolf/baz'), {route: '/foo/wolf/baz', params: {}, data: undefined});
    assert.deepEqual(r.resolve('/foo/car/baz'), {route: '/foo/:bar/baz', params: {bar: 'car'}, data: undefined});

    r.add('/:biz/wolf/baz');

    // it should match the most exact path it can
    assert.deepEqual(r.resolve('/foo/wolf/baz'), {route: '/foo/wolf/baz', params: {}, data: undefined});
    // it should match the most exact path it can
    assert.deepEqual(r.resolve('/car/wolf/baz'), {route: '/:biz/wolf/baz', params: {biz: 'car'}, data: undefined});

    // for a bunch of possible matches, it should match the first added
    r.add('/:1/a/:3/:4/wolf');
    r.add('/:1/:2/b/:4/wolf');

    assert.deepEqual(r.resolve('/wolf/a/b/c/wolf'), {route: '/:1/a/:3/:4/wolf', params: {1: 'wolf', 3: 'b', 4: 'c'}, data: undefined});

    r.remove('/:1/a/:3/:4/wolf');

    assert.deepEqual(r.resolve('/wolf/a/b/c/wolf'), {route: '/:1/:2/b/:4/wolf', params: {1: 'wolf', 2: 'a', 4: 'c'}, data: undefined});

    r.remove('/:1/:2/b/:4/wolf');
    assert.deepEqual(r.resolve('/wolf/a/b/c/wolf'), null);

    r.remove('/:biz/wolf/baz');

    assert.deepEqual(r.resolve('/foo/wolf/baz'), {route: '/foo/wolf/baz', params: {}, data: undefined});

    // it should match the most exact path it can
    assert.deepEqual(r.resolve('/car/wolf/baz'), null);

    r.remove('/foo/wolf/baz');

    assert.deepEqual(r.resolve('/foo/wolf/baz'), {route: '/foo/:bar/baz', params: {bar: 'wolf'}, data: undefined});

    r.remove('/foo/:bar/baz');
    assert.deepEqual(r.resolve('/foo/wolf/baz'), null);

    r.remove('/foo/:bar/baz');

    r.remove('1/2/3/4/');
    r.remove('1/2/3/4');
    r.remove('/1/2/3/4');

    r.remove('/foo/bin');

    assert.equal(r.toString(), '');
  });

  it('should route with matched data', function() {
    var r = new Router();

    r.add('/foo/:param/bar', {a: 1});
    r.add('/foo/:param/baz');

    assert.deepEqual(r.resolve('/foo/1/bar'), {route: '/foo/:param/bar', params: {param: '1'}, data: {a: 1}});
    assert.deepEqual(r.resolve('/foo/1/baz'), {route: '/foo/:param/baz', params: {param: '1'}, data: undefined});
  });

  it('should match the best route', function() {
    var r = new Router();

    r.add('/a/b/:a/:b/:c', false);
    r.add('/:a/:b/a/b/c', true);

    assert.deepEqual(r.resolve('/a/b/a/b/c'), {route: '/:a/:b/a/b/c', params: {a: 'a', b: 'b'}, data: true});
  });
});
