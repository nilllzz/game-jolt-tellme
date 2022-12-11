import dotenv from 'dotenv-safe'

import { ChatGPTAPI } from './chatgpt-api'
import { ChatGPTConversation } from './chatgpt-conversation'
import { GjComment } from './gj-comment'
import { GjConversation } from './gj-conversation'
import GridClient from './grid-client'

dotenv.config()

const chatgpt = new ChatGPTAPI({
  sessionToken: process.env.SESSION_TOKEN,
  markdown: false
})
await chatgpt.ensureAuth()

const grid = new GridClient()
await grid.connect()

await grid.createNotificationsChannel(async (response) => {
  const eventItem = response.notification_data.event_item
  console.log(`Received event ${eventItem.id}`)

  switch (eventItem.type) {
    case 'mention':
      await handleMention(eventItem)
      break
    case 'comment-add':
      await handleCommentReply(eventItem)
      break
    default:
      console.log(`    Skip handling of event ${eventItem.type}`)
      break
  }
})

function createPrompt(input: string): string {
  let prompt = input
  if (prompt.toLowerCase().startsWith('@tellme')) {
    prompt = 'Tell me ' + input.substring('@tellme'.length)
  }
  prompt = prompt.replaceAll(/[^a-zA-Z0-9 ,_+\-\.!?:;]/g, '')
  if (!prompt.match(/[\.,;:!? ]$/g)) {
    prompt = prompt + ','
  }
  prompt += ' respond in one or two sentences.'
  prompt = prompt.replaceAll('  ', ' ')

  return prompt
}

function logResponse(success: boolean, eventId: number, text: string) {
  if (!success) {
    console.log(`    Failed to respond to event ${eventId}`);
    return
  }

  if (text.length > 100) {
    text = text.substring(0, 100) + '...'
  }
  console.log(`    Responded to event ${eventId}: "${text}"`)
}

function isTextPrompt(text: string) {
  return text.toLowerCase().replace('\n', ' ').startsWith('@tellme ')
}

async function handleMention(eventItem) {
  // Has to be mentioned in a post.
  const mention = eventItem.action_resource_model
  if (mention.resource !== 'Fireside_Post' || !mention.fireside_post) {
    console.log(`    Ignore mention on a ${mention.resource}`)
    return
  }

  const post = mention.fireside_post
  const leadText = post.leadStr

  // Lead has to be formatted as "@tellme ..."
  if (!isTextPrompt(leadText)) {
    console.log(`    Post lead was not property formatted: ${leadText}`)
    return
  }

  const fromUserId = eventItem.from_resource_id
  const fromUser = post.user.username

  const resource = mention.resource
  const resourceId = mention.resource_id

  console.log(
    `    Respond to request by user @${fromUser} (${fromUserId}): ${leadText}...`
  )

  let prompt = createPrompt(leadText)
  console.log(`    Sending request to ChatGPT...`, { prompt })

  let chatResponse
  try {
    const conversation = new ChatGPTConversation(chatgpt)
    chatResponse = await conversation.sendMessage(prompt)

    // Record new conversation.
    GjConversation.recordNew(
      resourceId,
      conversation.conversationId,
      conversation.parentMessageId
    )
  } catch (error) {
    console.error('    ERROR from ChatGPT', error.statusText)
    chatResponse = 'I apologize, but I am over capacity and unable to respond at this time. Please try again later 🗿.'
  }

  console.log(`    Create response comment on ${resource} (${resourceId})`)
  const success = await GjComment.create(chatResponse, resource, resourceId)
  logResponse(success, eventItem.id, chatResponse)
}

async function handleCommentReply(eventItem) {
  const comment = eventItem.action_resource_model

  const resource = comment.resource
  if (resource !== 'Fireside_Post') {
    console.log(`    Do not handle comment reply on ${resource}`)
    return
  }

  const postOwnerUserId = eventItem.to_resource_model.user.id
  const fromUserId = eventItem.from_resource_id
  if (fromUserId != postOwnerUserId) {
    console.log(`    Comment is not from the post owner.`)
    return
  }

  const resourceId = comment.resource_id

  // Get conversation for post id.
  const gjConversation = await GjConversation.getConversationForPost(resourceId)
  if (!gjConversation || !gjConversation.conversationId) {
    console.log(`    Could not find conversation data for post ${resourceId}`)
    return
  }

  if (gjConversation.reachedEnd) {
    console.log(`    Reached end of conversation`)
    return
  }

  const commentContentDoc = JSON.parse(comment.comment_content)
  const commentText = GjComment.getTextFromContentDoc(commentContentDoc)

  // Comment has to be formatted as "@tellme ..."
  //   if (!isTextPrompt(commentText)) {
  //     console.log(`    Comment text was not a request: ${commentText}`)
  //     return
  //   }

  if (commentText.length <= 3) {
    console.log(`    Comment text was too short: ${commentText}`)
    return
  }

  const fromUser = eventItem.from_resource_model.username

  console.log(
    `    Respond to request by user @${fromUser} (${fromUserId}): ${commentText}...`
  )

  let prompt = createPrompt(commentText)
  console.log(`    Sending request to ChatGPT...`, { prompt })

  let chatResponse
  try {
    if (gjConversation.responses < 3) {
      const conversation = new ChatGPTConversation(chatgpt, {
        conversationId: gjConversation.conversationId,
        parentMessageId: gjConversation.parentMessageId
      })
      chatResponse = await conversation.sendMessage(prompt)
  
      gjConversation.recordResponse(conversation.parentMessageId)
    } else {
      console.log('    Conversation max responses reached.')
      chatResponse = 'I have reached the conversation message limit, please make a new post to keep talking with me 🗿.';
      gjConversation.recordEndOfConversation();
    }
  } catch (error) {
    console.error('    ERROR from ChatGPT', error.statusText)
    chatResponse =
      'I apologize, but I am over capacity and unable to respond at this time. Please try again later 🗿.'
  }

  console.log(`    Create response comment on ${resource} (${resourceId})`)
  const success = await GjComment.create(chatResponse, resource, resourceId, comment.parent_id)
  logResponse(success, eventItem.id, chatResponse)
}
