var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

class LambdaRouter {

  constructor(options = {}) {
    this.routes = {};
    this.headers = options.headers || {};
    this.onInvoke = options.onInvoke;
    this.onError = options.onError;
  }

  handler() {
    var _this = this;

    //eslint-disable-next-line
    return (() => {
      var _ref = _asyncToGenerator(function* (event, context, cb) {
        // Prevent callback waiting.
        // IMPORTANT, otherwise lambda may potentially timeout
        // needlessly.
        context.callbackWaitsForEmptyEventLoop = false;

        const handler = _this._divineRoute(event);

        if (!handler) {
          cb(null, new Response('Resource not found', 405).getResponse());
          return;
        }

        if (_this.onInvoke) _this.onInvoke(event);

        try {
          const response = new Response();
          response.headers = _this.headers;

          const payload = yield handler({ event, context, response });
          response.payload = Object.assign(response.payload, payload);

          return cb(null, response.getResponse());
        } catch (err) {

          const response = new Response(err.message, 500);

          if (_this.onError) _this.onError(response, err, event);

          cb(null, response.getResponse());
        }
      });

      return function (_x, _x2, _x3) {
        return _ref.apply(this, arguments);
      };
    })();
  }

  get(path, handler) {
    this._wrap('GET', path, handler);
  }

  post(path, handler) {
    this._wrap('POST', path, handler);
  }

  put(path, handler) {
    this._wrap('PUT', path, handler);
  }

  del(path, handler) {
    this._wrap('DELETE', path, handler);
  }

  options(path, handler) {
    this._wrap('OPTIONS', path, handler);
  }

  _wrap(method, path, handler) {
    if (this.routes[method] && this.routes[method][path]) throw new Error('You can only declare on handler for each method');
    this.routes = _extends({}, this.routes, {
      [method]: _extends({}, this.routes[method], {
        [path]: handler
      })
    });
  }

  _divineRoute({ httpMethod, resource }) {
    if (!this.routes[httpMethod] || !this.routes[httpMethod][resource]) return;
    return this.routes[httpMethod][resource];
  }
}

class Response {
  constructor(initialPayload = {}, statusCode = 200) {
    this.payload = initialPayload;
    this.statusCode = statusCode;
  }

  getResponse() {
    const body = {
      message: this.statusCode >= 200 && this.statusCode < 300 ? 'success' : 'error',
      payload: this.payload
    };
    return {
      headers: this.headers ? this.headers : {},
      statusCode: this.statusCode,
      body: JSON.stringify(body)
    };
  }
}

module.exports = LambdaRouter;