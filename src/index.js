class LambdaRouter {

  constructor(options = {}) {
    this.routes = {}
    this.headers = options.headers || {}
    this.onInvoke = options.onInvoke
    this.onError = options.onError
  }

  handler() {
    return async (event, context, cb) => {
      // Prevent callback waiting.
      // IMPORTANT, otherwise lambda may potentially timeout
      // needlessly.
      context.callbackWaitsForEmptyEventLoop = false

      const handler = this._divineRoute(event)

      if (!handler) {
        cb(null, new Response('Resource not found', 504))
        return
      }

      if (this.onInvoke) this.onInvoke(event)

      try {
        const response = new Response()
        response.headers = this.headers

        const payload = await handler({ event, context, response })
        response.payload = Object.assign(response.payload, payload)

        return cb(null, response.getResponse())

      } catch (err) {

        const body = this.onError
          ? this.onError(new Response(err.message), event)
          : new Response(err.message, 500)

        cb(null, body.getResponse())
      }
    }
  }

  get(path, handler) {
    this._wrap('GET', path, handler)
  }

  post(path, handler) {
    this._wrap('POST', path, handler)
  }

  put(path, handler) {
    this._wrap('PUT', path, handler)
  }

  del(path, handler) {
    this._wrap('DELETE', path, handler)
  }

  options(path, handler) {
    this._wrap('OPTIONS', path, handler)
  }

  _wrap(method, path, handler) {
    if (this.routes[method] && this.routers[method][path]) throw new Error('You can only declare on handler for each method')
    this.routes = {
      ...this.routes,
      [method]: {
        ...this.routes[method],
        [path]: handler,
      },
    }
  }

  _divineRoute({ httpMethod, resource }) {
    if (!this.routes[httpMethod] || !this.routes[httpMethod][resource]) return
    return this.routes[httpMethod][resource]
  }
}


class Response {
  constructor(initialPayload = {}, statusCode = 200) {
    this.payload = initialPayload
    this.statusCode = statusCode
  }

  getResponse() {
    const body = {
      message: this.statusCode >= 200 && this.statusCode < 300 ? 'success' : 'error',
      payload: this.payload,
    }
    return {
      headers: this.headers ? this.headers : {},
      statusCode: this.statusCode,
      body: JSON.stringify(body),
    }
  }
}

module.exports = LambdaRouter
