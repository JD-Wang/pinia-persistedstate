import { Store, PiniaPluginContext, MutationType } from 'pinia'
import merge from 'deepmerge'
import * as shvl from 'shvl'

// eslint-disable-next-line @typescript-eslint/no-empty-function
const NOOP = () => {}

const isEmptyArray = (arr) => Array.isArray(arr) && arr.length !== 0

interface Storage {
  getItem: (key: string) => any
  setItem: (key: string, value: any) => void
  removeItem: (key: string) => void
}

interface Options {
  key?: string
  paths?: string[]
  reducer?: (state: any, paths: string[]) => object
  subscriber?: (store: Store) => (handler: (mutation: any, state: any) => void) => void
  storage?: Storage
  getState?: (key: string, storage: Storage) => any
  setState?: (key: string, state: any, storage: Storage) => void
  filter?: (mutation: MutationType) => boolean
  arrayMerger?: (state: any[], saved: any[]) => any
  rehydrated?: (store: Store) => void
  fetchBeforeUse?: boolean
  overwrite?: boolean
  assertStorage?: (storage: Storage) => void | Error
}

export default function (options?: Options): (context: PiniaPluginContext) => void {
  options = options || {}

  const storage = options.storage || (window && window.localStorage)
  const key = options.key || 'pinia'

  function getState(key, storage) {
    const value = storage.getItem(key)

    try {
      return typeof value === 'string'
        ? JSON.parse(value)
        : typeof value === 'object'
        ? value
        : undefined
    } catch (err) {}

    return undefined
  }

  function filter() {
    return true
  }

  function setState(key, state, storage) {
    return storage.setItem(key, JSON.stringify(state))
  }

  function reducer(state, paths) {
    return Array.isArray(paths)
      ? paths.reduce(function (substate, path) {
          return shvl.set(substate, `${path}`, shvl.get(state, path))
        }, {})
      : state
  }

  function subscriber(store) {
    return function (handler) {
      return store.$subscribe(handler)
    }
  }

  const assertStorage =
    options.assertStorage ||
    (() => {
      storage.setItem('@@', 1)
      storage.removeItem('@@')
    })

  assertStorage(storage)

  const fetchSavedState = () => (options?.getState || getState)(key, storage)

  let savedState

  if (options.fetchBeforeUse) {
    savedState = fetchSavedState()
  }

  return function (context: PiniaPluginContext) {
    if (!options?.fetchBeforeUse) {
      savedState = fetchSavedState()
    }

    if (typeof savedState === 'object' && savedState !== null) {
      const id = context.store.$id
      if (savedState[id]) {
        context.store.$state = options?.overwrite
          ? savedState
          : merge(context.store.$state, savedState[id], {
              arrayMerge:
                options?.arrayMerger ||
                function (store, saved) {
                  return saved
                },
              clone: false
            })
        ;(options?.rehydrated || NOOP)(context.store)
      }
    }

    ;(options?.subscriber || subscriber)(context.store)(function (mutation, state) {
      const pState = context.pinia.state.value
      const id = context.store.$id
      if (!options?.fetchBeforeUse) {
        savedState = fetchSavedState()
      }
      if ((options?.filter || filter)(mutation)) {
        if (isEmptyArray(options?.paths) && options?.paths?.some((_) => _.indexOf(id) !== -1)) {
          ;(options?.setState || setState)(
            key,
            isEmptyArray(options?.paths)
              ? merge(
                  savedState,
                  (options?.reducer || reducer)(
                    pState,
                    options?.paths.filter((_) => _.indexOf(id) !== -1)
                  ),
                  {
                    arrayMerge:
                      options?.arrayMerger ||
                      function (store, saved) {
                        return saved
                      },
                    clone: false
                  }
                )
              : pState,
            storage
          )
        }
      }
    })
  }
}
