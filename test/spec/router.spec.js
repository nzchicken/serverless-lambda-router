const Boom = require('boom');
const LambdaRouter = require('../../src');
const { methods, getEvent } = require('../util/data');

describe('Lambda Router', () => {

  it('should export a function', () => expect(LambdaRouter).to.be.a('function'));

  describe('on instantiation', () => {
    let router;
    beforeEach(() => router = new LambdaRouter());

    it('should have an empty set of routes', () => expect(router.routes).to.be.a('object'));

    methods.forEach(method => {
      it(`should expose a ${ method } method`, () => expect(router[method]).to.be.a('function'));
      it(`#${ method } should add a route`, () => {
        const handler = sinon.spy();
        const key = method === 'del' ? 'DELETE' : method.toUpperCase();

        router[method]('/foo', handler);
        expect(router.routes[key]).to.be.a('object');
        expect(router.routes[key]['/foo']).to.be.a('function');
      });
      it(`#${ method } should prevent more than one handler`, () => {
        const handler = sinon.spy();
        const key = method === 'del' ? 'DELETE' : method.toUpperCase();

        const func = () => { router[method]('/foo', handler )};

        expect(func).to.not.throw();
        expect(func).to.throw();
      })
    });
  });

  describe('#handler', () => {
    let router, cb, context;

    beforeEach(() => {
      router = new LambdaRouter();
      cb = sinon.spy();
      context = {};
    });

    it('should return a function', () => {
      expect(router.handler()).to.be.a('function');
    });

    it('should prevent callback from waiting on event loop', async () => {
      const handler = router.handler();

      try {
        await handler({}, context, cb);
      } catch (err) {}
      expect(context.callbackWaitsForEmptyEventLoop).to.equal(false);
    });

    it('should fail if no handlers are found', async () => {
      const handler = router.handler();

      await handler(getEvent('GET', '/foo'), context, cb);

      const args = cb.getCall(0).args;
      expect(cb).to.have.been.called;
      expect(args[0]).to.equal(null);
      expect(args[1].statusCode).to.equal(504);
    });

    it('should invoke handler matching a given route', async () => {
      const routeHandler = sinon.spy();
      const handler = router.handler();

      router.get('/foo', routeHandler);
      await handler(getEvent('GET', '/foo'), context, cb);

      expect(routeHandler).to.have.been.called;
    });

    it('should invoke callback with successful response if handler does not throw', async () => {
      const routeHandler = sinon.stub().resolves({ foo: 'bar' });
      const handler = router.handler();

      router.get('/foo', routeHandler);
      await handler(getEvent('GET', '/foo'), context, cb);

      const args = cb.getCall(0).args;
      expect(cb).to.have.been.called;
      expect(args[0]).to.equal(null);
      expect(args[1].statusCode).to.equal(200);
      expect(JSON.parse(args[1].body).message).to.equal('success');
    });

    it('should invoke callback with failure response if handler throws', async () => {
      const routeHandler = sinon.stub().rejects(new Error('test exception'));
      const handler = router.handler();

      router.get('/foo', routeHandler);
      await handler(getEvent('GET', '/foo'), context, cb);

      const args = cb.getCall(0).args;
      expect(cb).to.have.been.called;
      expect(args[0]).to.equal(null);
      expect(args[1].statusCode).to.equal(500);
      expect(JSON.parse(args[1].body).message).to.equal('error');
    });

    it('should attach provided headers to response', async () => {
      router = new LambdaRouter({ headers: { 'Authorization': 'foo' }});
      const routeHandler = sinon.stub().resolves({ foo: 'bar' });
      const handler = router.handler();

      router.get('/foo', routeHandler);
      await handler(getEvent('GET', '/foo'), context, cb);

      const args = cb.getCall(0).args;
      expect(cb).to.have.been.called;
      expect(args[0]).to.equal(null);
      expect(args[1].headers).to.be.an('object');
      expect(args[1].headers.Authorization).to.equal('foo');
    });

    it('should call `onInvoke` handler when route is found', async () => {
      const onInvoke = sinon.spy();
      router = new LambdaRouter({ onInvoke });
      const routeHandler = sinon.stub().resolves({ foo: 'bar' });
      const handler = router.handler();

      router.get('/foo', routeHandler);
      await handler(getEvent('GET', '/foo'), context, cb);

      expect(cb).to.have.been.called;
      expect(onInvoke).to.have.been.called;
    });

    it('should call `onError` handler if route handler throws', async () => {
      const bodyStub = sinon.stub();
      const onError = sinon.stub().returns({ getResponse: bodyStub });
      router = new LambdaRouter({ onError });
      const routeHandler = sinon.stub().rejects(new Error('testing exception'));
      const handler = router.handler();

      router.get('/foo', routeHandler);
      await handler(getEvent('GET', '/foo'), context, cb);

      const args = cb.getCall(0).args;
      expect(args[0]).to.equal(null);
      expect(cb).to.have.been.called;
      expect(onError).to.have.been.called;
    });
  });
});
