import * as fs from 'fs'

export class GjConversation {
  public conversationId: string | null
  public parentMessageId: string | null
  public postId: number
  public responses: number
  public reachedEnd: boolean

  constructor(conversationId: string, parentMessageId: string, postId: number, responses: number, reachedEnd: boolean) {
    this.conversationId = conversationId
    this.parentMessageId = parentMessageId
    this.postId = postId
    this.responses = responses
    this.reachedEnd = reachedEnd
  }

  public static recordNew(postId, conversationId, parentMessageId) {
    const content = JSON.stringify({
      conversationId,
      postId,
      parentMessageId,
      responses: 1,
      reachedEnd: false
    })
    fs.writeFile(`./conversations/${postId}.txt`, content, (err) => {
      if (err) console.log(err)
    })
  }

  public static async getConversationForPost(
    postId
  ): Promise<GjConversation | null> {
    const exists = fs.existsSync(`./conversations/${postId}.txt`)
    if (!exists) {
      return null
    }

    return new Promise((resolve) => {
      fs.readFile(`./conversations/${postId}.txt`, (err, buffer) => {
        if (err) {
          console.log(err)
          resolve(null)
        }

        const data = JSON.parse(buffer.toString())
        resolve(
          new GjConversation(
            data.conversationId,
            data.parentMessageId,
            data.postId,
            data.responses || 1,
            data.reachedEnd || false
          )
        )
      })
    })
  }

  private _write() {
    const content = JSON.stringify({
      conversationId: this.conversationId,
      postId: this.postId,
      parentMessageId: this.parentMessageId,
      responses: this.responses,
      reachedEnd: this.reachedEnd,
    })
    fs.writeFile(`./conversations/${this.postId}.txt`, content, (err) => {
      if (err) console.log(err)
    })
  }

  public recordResponse(parentMessageId) {
    this.parentMessageId = parentMessageId;
    this.responses += 1;

    this._write();
  }

  public recordEndOfConversation() {
    this.reachedEnd = true;

    this._write();
  }
}
