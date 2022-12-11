export class GjComment {
  public static async create(
    text: string,
    resource: string,
    resourceId: number,
    parentId: number | null = null
  ) {
    const doc = {
      version: '1.0.0',
      createdOn: Date.now(),
      context: 'fireside-post-comment',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: text
            }
          ]
        }
      ]
    }

    const content = JSON.stringify(doc)

    const body = {
      resource,
      resource_id: resourceId,
      comment_content: content
    }

    if (parentId) {
      body['parent_id'] = parentId
    }

    const frontendCookie = process.env.GJ_FRONTEND_COOKIE

    const response = await fetch(
      'https://gamejolt.com/site-api/comments/save',
      {
        method: 'POST',
        body: JSON.stringify(body),
        headers: {
          cookie: `frontend=${frontendCookie}`
        }
      }
    )

    console.log('    ' + response.status)
  }

  private static _getTextFromContentObj(obj: any) {
    let text = ''
    if (obj.text) {
      text = obj.text
    } else if (obj.content && Array.isArray(obj.content)) {
      for (const subObj of obj.content) {
        text += this._getTextFromContentObj(subObj)
      }
    }
    return text
  }

  public static getTextFromContentDoc(doc: any) {
    return this._getTextFromContentObj(doc)
  }
}
