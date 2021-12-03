import { Store, PiniaPluginContext, MutationType } from 'pinia'
import merge from 'deepmerge'
import * as shvl from 'shvl'

const NOOP = () => {
  return
}

const isNotEmptyArray = (arr) => Array.isArray(arr) && arr.length > 0

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
  getState?: (key: string) => any
  setState?: (key: string, state: any) => void
  filter?: (mutation: MutationType) => boolean
  arrayMerger?: (state: any[], saved: any[]) => any
  rehydrated?: (store: Store) => void
  fetchBeforeUse?: boolean
  overwrite?: boolean
  assertStorage?: (storage: Storage) => void | Error
}

export default function (options: Options = {}): (context: PiniaPluginContext) => void {
  const storage = options.storage || (window && window.localStorage)
  const key = options.key || 'pinia'

  function getState(key) {
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

  function setState(key, state) {
    return storage.setItem(key, JSON.stringify(state))
  }

  function filter() {
    return true
  }

  function reducer(state, paths: Array<string>) {
    return isNotEmptyArray(paths)
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
      storage.setItem('@@', '1')
      storage.removeItem('@@')
    })

  assertStorage(storage)

  const fetchSavedState = () => (options.getState || getState)(key)

  let savedState

  if (options.fetchBeforeUse) {
    savedState = fetchSavedState()
  }

  return function ({ store, pinia }: PiniaPluginContext) {
    if (!options.fetchBeforeUse) {
      savedState = fetchSavedState()
    }

    if (typeof savedState === 'object' && savedState !== null) {
      const id = store.$id
      if (savedState[id]) {
        store.$state = options.overwrite
          ? savedState
          : merge(store.$state, savedState[id], {
              arrayMerge:
                options.arrayMerger ||
                function (store, saved) {
                  return saved
                },
              clone: false
            })
        ;(options.rehydrated || NOOP)(store)
      }
    }

    ;(options.subscriber || subscriber)(store)(function (mutation, state) {
      const pState = pinia.state.value
      const id = store.$id
      if (!options.fetchBeforeUse) {
        savedState = fetchSavedState()
      }
      if ((options.filter || filter)(mutation)) {
        const newState = merge(
          savedState,
          isNotEmptyArray(options.paths)
            ? (options.reducer || reducer)(
                pState,
                (options.paths as Array<string>).filter((_) => _.indexOf(id) !== -1)
              )
            : pState,
          {
            arrayMerge:
              options.arrayMerger ||
              function (store, saved) {
                return saved
              },
            clone: false
          }
        )
        ;(options.setState || setState)(key, newState)
      }
    })
  }
}
