// import { fetch } from './fetch'
import * as ws from 'ws'
import { Channel, Socket } from 'phoenix'

export default class GridClient {
  private _frontendCookie: string
  private _userId: number
  private _host: string
  private _token: string
  private _socket: Socket

  constructor() {
    this._frontendCookie = process.env.GJ_FRONTEND_COOKIE
    this._userId = parseInt(process.env.GJ_USER_ID, 10)
    console.log(this._userId)
  }

  private async getHost(): Promise<string> {
    const response = await fetch('https://grid.gamejolt.com/grid/host')
    const host = await response.text()
    return host
  }

  private async getToken(): Promise<string> {
    const body = JSON.stringify({
      auth_token: this._frontendCookie,
      user_id: this._userId
    })
    const response = await fetch('https://grid.gamejolt.com/grid/token', {
      method: 'POST',
      body,
      headers: {
        'Content-Type': 'application/json'
      }
    })

    const responseObj = await response.json()
    return responseObj.token
  }

  public async connect(): Promise<void> {
    const host = await this.getHost()
    this._host = host
    console.log('Connect to Grid host:', host)

    this._token = await this.getToken()
    console.log('Got token.')

    const socket = new Socket(this._host + '/grid/socket', {
      heartbeatIntervalMs: 30_000,
      params: {
        token: this._token,
        gj_platform: 'web',
        gj_platform_version: '1.19.0'
      },
      transport: ws.WebSocket
    })

    // meme
    const socketAny: any = socket
    if (Object.prototype.hasOwnProperty.call(socketAny, 'reconnectTimer')) {
      socketAny.reconnectTimer = { scheduleTimeout: () => {}, reset: () => {} }
    }

    this._socket = socket

    return new Promise((resolve) => {
      socket.onOpen(() => {
        console.log('Connected to socket.')
        resolve()
      })

      socket.connect()
    })
  }

  public async createNotificationsChannel(
    callback: (x: any) => void
  ): Promise<Channel> {
    const channel = this._socket.channel('notifications:' + this._userId)
    return new Promise((resolve) => {
      channel.on('new-notification', callback)

      channel.join().receive('ok', (response) => {
        console.log('Joined notification channel')
        resolve(channel)
      })
    })
  }
}
