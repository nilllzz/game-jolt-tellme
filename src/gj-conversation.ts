import * as fs from 'fs'

export class GjConversation {
  public conversationId: string | null
  public parentMessageId: string | null
  public postId: number

  constructor(conversationId: string, parentMessageId: string, postId: number) {
    this.conversationId = conversationId
    this.parentMessageId = parentMessageId
    this.postId = postId
  }

  public static recordNew(postId, conversationId, parentMessageId) {
    const content = JSON.stringify({
      conversationId,
      postId,
      parentMessageId
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
            data.postId
          )
        )
      })
    })
  }

  public recordResponse(parentMessageId) {
    const content = JSON.stringify({
      conversationId: this.conversationId,
      postId: this.postId,
      parentMessageId
    })
    fs.writeFile(`./conversations/${this.postId}.txt`, content, (err) => {
      if (err) console.log(err)
    })
  }
}
