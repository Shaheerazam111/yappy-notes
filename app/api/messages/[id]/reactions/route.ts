import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { ObjectId } from 'mongodb';

// POST - Add or remove a reaction to a message
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId, emoji } = await request.json();

    if (!id || !userId || !emoji) {
      return NextResponse.json(
        { error: 'Message ID, user ID, and emoji are required' },
        { status: 400 }
      );
    }

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid message ID' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const messageId = new ObjectId(id);

    // Get the current message
    const message = await db.collection('messages').findOne({
      _id: messageId,
    });

    if (!message) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    // Initialize reactions array if it doesn't exist
    const reactions = message.reactions || [];

    // Check if user already reacted with this emoji
    const existingReactionIndex = reactions.findIndex(
      (r: any) => r.userId === userId && r.emoji === emoji
    );

    let updatedReactions;
    if (existingReactionIndex >= 0) {
      // Remove the reaction (toggle off)
      updatedReactions = reactions.filter(
        (_: any, index: number) => index !== existingReactionIndex
      );
    } else {
      // Add the reaction
      updatedReactions = [...reactions, { userId, emoji }];
    }

    // Update the message
    await db.collection('messages').updateOne(
      { _id: messageId },
      { $set: { reactions: updatedReactions } }
    );

    return NextResponse.json({
      success: true,
      reactions: updatedReactions,
    });
  } catch (error) {
    console.error('Error updating reaction:', error);
    return NextResponse.json(
      { error: 'Failed to update reaction' },
      { status: 500 }
    );
  }
}

