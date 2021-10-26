# pinia-persistedstate

For vue3. Persist and rehydrate your Pinia state between page reloads. frok from [vuex-persistedstate](https://github.com/robinvdvleuten/vuex-persistedstate)

<hr />

## Install

```bash
npm install --save pinia-persistedstate
```

The [UMD](https://github.com/umdjs/umd) build is also available on [unpkg](https://unpkg.com):

```html
<script src="https://unpkg.com/pinia-persistedstate/dist/pinia-persistedstate.umd.js"></script>
```

You can find the library on `window.createPersistedState`.

## Usage

```js
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import persistedstate from 'pinia-persistedstate'
import App from './App'

const app = createApp(App)
const store = createPinia()

store.use(
  persistedstate({
    key: 'client'
    // paths: ['dataStore', 'dataStore.count']  // Keep state, use module id, or state
  })
)

app.use(store)
```

### Example with pinia modules

New plugin instances can be created in separate files, but must be imported and added to plugins object in the main pinia file.

```js
/* module.js */
import { defineStore } from 'pinia'

export const dataStore = defineStore({
  id: 'dataStore',
  state: () => {
    return {
      count: 0
    }
  },
  actions: {
    increment(data) {
      this.count = data
    }
  }
})


/* demo.tsx */
import { dataStore } from './module'

...
  setup: () => {
    const store = dataStore()

    store.increment()

    return () => {
      <div>{ store.count }</div>
    }
  }
...

```

```javascript
// ~/plugins/persistedState.js

import createPersistedState from 'pinia-persistedstate';
import * as Cookies from 'js-cookie';
import cookie from 'cookie';

export default ({ store, req }) => {
    createPersistedState({
        paths: [...],
        storage: {
            getItem: (key) => {
                if (process.server) {
                    const parsedCookies = cookie.parse(req.headers.cookie);
                    return parsedCookies[key];
                } else {
                    return Cookies.get(key);
                }
            },
            setItem: (key, value) =>
                Cookies.set(key, value, { expires: 365, secure: false }),
            removeItem: key => Cookies.remove(key)
        }
    })(store)
}
```

## API

### `createPersistedState([options])`

Creates a new instance of the plugin with the given options. The following options
can be provided to configure the plugin for your specific needs:

- `key <String>`: The key to store the persisted state under. Defaults to `pinia`.
- `paths <Array>`: An array of any paths to partially persist the state. If no paths are given, the complete state is persisted. If an empty array is given, no state is persisted. Paths must be specified using dot notation. If using modules, include the module name. eg: "auth.user" Defaults to `undefined`.
- `reducer <Function>`: A function that will be called to reduce the state to persist based on the given paths. Defaults to include the values.
- `subscriber <Function>`: A function called to setup mutation subscription. Defaults to `store => handler => store.subscribe(handler)`.

- `storage <Object>`: Instead of (or in combination with) `getState` and `setState`. Defaults to localStorage.
- `getState <Function>`: A function that will be called to rehydrate a previously persisted state. Defaults to using `storage`.
- `setState <Function>`: A function that will be called to persist the given state. Defaults to using `storage`.
- `filter <Function>`: A function that will be called to filter any mutations which will trigger `setState` on storage eventually. Defaults to `() => true`.
- `overwrite <Boolean>`: When rehydrating, whether to overwrite the existing state with the output from `getState` directly, instead of merging the two objects with `deepmerge`. Defaults to `false`.
- `arrayMerger <Function>`: A function for merging arrays when rehydrating state. Defaults to `function (store, saved) { return saved }` (saved state replaces supplied state).
- `rehydrated <Function>`: A function that will be called when the rehydration is finished. Useful when you are using Nuxt.js, which the rehydration of the persisted state happens asynchronously. Defaults to `store => {}`
- `fetchBeforeUse <Boolean>`: A boolean indicating if the state should be fetched from storage before the plugin is used. Defaults to `false`.
- `assertStorage <Function>`: An overridable function to ensure storage is available, fired on plugins's initialization. Default one is performing a Write-Delete operation on the given Storage instance. Note, default behaviour could throw an error (like `DOMException: QuotaExceededError`).

## Customize Storage

If it's not ideal to have the state of the pinia store inside localstorage. One can easily implement the functionality to use [cookies](https://github.com/js-cookie/js-cookie) for that (or any other you can think of);


In fact, any object following the Storage protocol (getItem, setItem, removeItem, etc) could be passed:

```js
createPersistedState({ 
  storage: window.sessionStorage 
})
```

This is especially useful when you are using this plugin in combination with server-side rendering, where one could pass an instance of [dom-storage](https://www.npmjs.com/package/dom-storage).

### 🔐Obfuscate Local Storage

If you need to use **Local Storage** (or you want to) but want to prevent attackers from easily inspecting the stored data, you can [obfuscate it]('https://github.com/softvar/secure-ls').

**Important ⚠️** Obfuscating the pinia store means to prevent attackers from easily gaining access to the data. This is not a secure way of storing sensitive data (like passwords, personal information, etc.), and always needs to be used in conjunction with some other authentication method of keeping the data (such as Firebase or your own server).

```js
import { Store } from "pinia";
import createPersistedState from "pinia-persistedstate";
import SecureLS from "secure-ls";
var ls = new SecureLS({ isCompression: false });

// https://github.com/softvar/secure-ls

createPersistedState({
  storage: {
    getItem: (key) => ls.get(key),
    setItem: (key, value) => ls.set(key, value),
    removeItem: (key) => ls.remove(key)
  }
})
```
