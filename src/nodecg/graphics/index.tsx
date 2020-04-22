import { h, app } from "hyperapp"
import { Mutex } from "await-semaphore"
import ReplicantManager from "../../common/replicant-manager"
import Renderer from "../../common/renderer"
import deepEqual from "fast-deep-equal"
import DataProcessor from "../../common/data-processor"
import { CanvasReferences } from "../../common/canvas-references"
import GameRenderer from "../../common/game-renderer"

const r = Renderer.getInstance()

const replicantManager = new ReplicantManager({
  messages: {
    "changeScene": (dispatch, to) => {
      dispatch(startTransition, to)
    },
    "reloadIcons": (dispatch) => {
      dispatch(reloadIcons)
    },
    "updateCanvasContexts": (dispatch) => {
      dispatch(updateCanvasContexts)
    }
  }
})

const updateTransition = (state, phase) => {
  if (phase == 8) {
    return {
      ...state,
      currentView: state.transitionTo,
      transitionTo: null,
      transitionPhase: -1,
    }
  }
  return {
    ...state,
    transitionPhase: phase
  }
}

const reloadIcons = (state) => {
  r.userIcons.clear()
  return state
}

let canvasContexts: CanvasReferences = {
  "default": [],
  "qualifier": [],
  "qualifier-ranking": [],
  "1v1a": [],
  "1v1b": [],
  "1v1v1": [],
  "award": []
}

const updateCanvasContexts = (state) => {
  const result = {
    "default": [],
    "qualifier": [],
    "qualifier-ranking": [],
    "1v1a": [],
    "1v1b": [],
    "1v1v1": [],
    "award": []
  }

  ;[state.currentView, state.transitionTo].forEach(view => {
    switch (view) {
      case "game-qualifier": {
        const elements = Array.from(document.querySelectorAll<HTMLCanvasElement>(`#${view}>.game-container>canvas`))
        result["qualifier"].push(elements.map(e => ({ context: e.getContext("2d"), position: null })))
        const rankingElement = document.querySelector<HTMLCanvasElement>(`#${view}>.ranking`)
        if (rankingElement != null) result["qualifier-ranking"].push(({ context: rankingElement.getContext("2d"), position: null }))
      }
      break
      case "game-1v1": {
        const elements = Array.from(document.querySelectorAll<HTMLCanvasElement>(`#${view}>.game-container>canvas`))
        if (elements.length >= 1) {
          result["1v1a"].push([
            { context: elements[0].getContext("2d"), position: 0 },
            { context: elements[0].getContext("2d"), position: 1 }
          ])
        }
      }
      break
      case "game-1v1-1v1": {
        const elements = Array.from(document.querySelectorAll<HTMLCanvasElement>(`#${view}>.game-container>canvas`))
        if (elements.length >= 2) {
          result["1v1a"].push([
            { context: elements[0].getContext("2d"), position: 0 },
            { context: elements[0].getContext("2d"), position: 1 }
          ])
          result["1v1b"].push([
            { context: elements[1].getContext("2d"), position: 0 },
            { context: elements[1].getContext("2d"), position: 1 }
          ])
        }
      }
      break
      case "game-1v1v1": {
        const elements = Array.from(document.querySelectorAll<HTMLCanvasElement>(`#${view}>.game-container>canvas`))
        result["1v1v1"].push(elements.map(e => ({ context: e.getContext("2d"), position: null })))
      }
      break
      case "game-award": {
        const element = document.querySelector<HTMLCanvasElement>(`#${view}>.award`)
        result["award"].push({ context: element.getContext("2d"), position: null })
      }
      break
    }
  })

  canvasContexts = result
  return state
}

const updateCanvasContextsEffect = dispatch => {
  setTimeout(() => dispatch(updateCanvasContexts), 100)
}

let onServerMessageCallback: Function = null

const onServerMessage = (state, data) => {
  const roomPlayers = {
    "all": data.users.length
  }
  Object.keys(data.rooms).forEach(room => {
    roomPlayers[room] = data.rooms[room].length
  })

  if (deepEqual(roomPlayers, state.roomPlayers)) {
    return state
  }
  return [{
    ...state,
    roomPlayers
  }, [updateCanvasContextsEffect]]
}

const onServerMessageEffect = (dispatch) => {
  onServerMessageCallback = (data) => dispatch(onServerMessage, data)
  return () => onServerMessageCallback = null
}

const transitionEffect = dispatch => {
  updateCanvasContextsEffect(dispatch)
  let phase = 0
  const fun = () => {
    phase++
    dispatch(updateTransition, phase)
    if (phase < 8) setTimeout(fun, 50)
    else updateCanvasContextsEffect(dispatch)
  }
  setTimeout(fun, 50)
}

const startTransition = (state, to) => {
  if (state.currentView == to || state.transitionPhase != -1) return state
  return [{
    ...state,
    transitionTo: to,
    transitionPhase: 0
  }, [transitionEffect]]
}

const calculateClip = (state, viewName) => {
  const b = -120 + state.transitionPhase * 270 + 135
  if (state.currentView == viewName) {
    return {
      "clip-path": `polygon(${b}px 0px, 1920px 0px, 1920px 1080px, ${b}px 1080px)`
    }
  }
  if (state.transitionTo == viewName) {
    return {
      "clip-path": `polygon(0px 0px, ${b}px 0px, ${b}px 1080px, 0px 1080px)`
    }
  }
  return {
    "clip-path": "polygon(0 0)"
  }
}

const constructGameElement = (state, type) => {
  const id = `game-${type}`
  const inner = () => {
    switch(type) {
    case "qualifier":
      const numPlayers = state.roomPlayers["qualifier"]
      const shrink = numPlayers <= 5 ? 0
                  : numPlayers <= 6 ? 400
                  : numPlayers <= 8 ? 300
                  : numPlayers <= 10 ? 150
                  : 0
      return [
        <div class="game-container game-container-qualifier" style={{ padding: `0 ${shrink}px` }}>
          {[...Array(numPlayers)].map((e, i) => {
            const className = numPlayers <= 3 ? "game-large" :
                              numPlayers <= 4 ? "game-medium": "game-small"
            return <canvas class={className} width="96" height="232"></canvas>
          })}
        </div>,
        <canvas class="ranking" width="104" height="254"></canvas>
      ]
    case "1v1":
      return [
        <div class="game-container">
          <canvas class="game-1v1-large" width="256" height="224"></canvas>
        </div>,
      ]
    case "1v1-1v1":
      return [
        <div class="game-container">
          <canvas class="game-1v1-medium" width="256" height="224"></canvas>
          <canvas class="game-1v1-medium" width="256" height="224"></canvas>
        </div>,
      ]
    case "1v1v1":
      return [
        <div class="game-container">
          <canvas class="game-large" width="96" height="232"></canvas>
          <canvas class="game-large" width="96" height="232"></canvas>
          <canvas class="game-large" width="96" height="232"></canvas>
        </div>,
      ]
    case "award":
      return [
        <canvas class="award" width="128" height="160"></canvas>
      ]
    }
  }
  return <div id={id} style={{ ...calculateClip(state, id) }}>
    {(state.currentView == id || state.transitionTo == id) && [
      inner(),
      <div class="game-footer">CTWC Japan Lite <span class="game-footer-variable">{state.nodecg.footer}</span></div>
    ]}
  </div>
}

let currentState: any = {}

Promise.all([
  replicantManager.initialize(),
]).then(([replicantInitialStates]) => {
  app({
    init: [
      {
        nodecg: replicantInitialStates,
        currentView: "title",
        transitionTo: "game",
        transitionPhase: -1,
        footer: "予選スコアアタック",
        roomPlayers: {}
      }
    ],
    view: state => (
      <div id="root">
        <div id="title" style={{ ...calculateClip(state, "title") }}>
          <div class="title-message">{state.nodecg.titleMessage}</div>
        </div>
        { constructGameElement(state, "qualifier") }
        { constructGameElement(state, "1v1") }
        { constructGameElement(state, "1v1-1v1") }
        { constructGameElement(state, "1v1v1") }
        { /*constructGameElement(state, "1v1v1v1")*/ }
        { constructGameElement(state, "award") }
        <div id="transition" style={{ left: (-120 + state.transitionPhase * 270) + "px" }}></div>
        {
          false && <div id="debug">
            <button onClick={[startTransition, "title"]}>title</button>
            <button onClick={[startTransition, "game-qualifier"]}>qual</button>
            <button onClick={[startTransition, "game-1v1"]}>2</button>
            {<button onClick={[startTransition, "game-1v1v1"]}>3</button>}
            {/*<button onClick={[startTransition, "game-1v1v1v1"]}>4</button>*/}
            <button onClick={[startTransition, "game-1v1-1v1"]}>22</button>
            <button onClick={[startTransition, "game-award"]}>award</button>
          </div>
        }
        { /* Expose current state */ (() => { currentState = state; return null })() }
      </div>
    ),
    subscriptions: state => [
      ...replicantManager.getSubscriptions(),
      [onServerMessageEffect, {}]
    ],
    node: document.querySelector("#root")
  })
})

const dataProcessor = new DataProcessor()

const newConnection = () => {
  let sock = new WebSocket(`${location.protocol == "https:" ? "wss" : "ws"}://${location.hostname}:5042`)

  sock.addEventListener("open", e => {
    console.log("WebSocket opened")
  })

  sock.addEventListener("message", async (e) => {
    const data = JSON.parse(await e.data.text())
    await dataProcessor.onData(data)
    if (onServerMessageCallback != null) onServerMessageCallback(data)
  })

  sock.addEventListener("close", e => {
    console.log("WebSocket closed")
    setTimeout(() => {
      webSocket = newConnection()
    }, 3000)
  })

  sock.addEventListener("error", e => {
    console.error(e)
  })

  return sock
}

let webSocket = newConnection()

r.initialize().then(() => {
  const onFrame = () => {
    dataProcessor.onRender()
    const qualifierRanking = dataProcessor.getRankingOfRoom("qualifier", true)
    const _1v1v1Ranking = dataProcessor.getRankingOfRoom("1v1v1", false)

    GameRenderer.renderRoom(canvasContexts["qualifier"], dataProcessor, "qualifier", 0, qualifierRanking.userToRankIndex)
    GameRenderer.renderRoom(canvasContexts["1v1a"], dataProcessor, "1v1a", 1)
    GameRenderer.renderRoom(canvasContexts["1v1b"], dataProcessor, "1v1b", 1)
    GameRenderer.renderRoom(canvasContexts["1v1v1"], dataProcessor, "1v1v1", 0, _1v1v1Ranking.userToRankIndex, _1v1v1Ranking.ranking)
    GameRenderer.renderQualifierRanking(canvasContexts["qualifier-ranking"], qualifierRanking.ranking)
    GameRenderer.renderAward(canvasContexts["award"], currentState.nodecg?.awardedPlayer)
  }

  const _onFrame = () => {
    onFrame()
    requestAnimationFrame(_onFrame)
  }
  requestAnimationFrame(_onFrame)
})
