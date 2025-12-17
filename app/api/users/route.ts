import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// GET - Get all users (for debugging, or get current user)
export async function GET(request: NextRequest) {
  try {
    const db = await getDb();
    const users = await db.collection('users').find({}).toArray();
    return NextResponse.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

// POST - Create a new user
export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json();

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const user = {
      name: name.trim(),
      createdAt: new Date(),
    };

    const result = await db.collection('users').insertOne(user);
    
    return NextResponse.json({
      _id: result.insertedId.toString(),
      ...user,
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}

// DELETE - Delete all users (reset app)
export async function DELETE() {
  try {
    const db = await getDb();
    await db.collection('users').deleteMany({});
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting users:', error);
    return NextResponse.json(
      { error: 'Failed to delete users' },
      { status: 500 }
    );
  }
}

