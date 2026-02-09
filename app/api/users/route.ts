import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// GET - Get all users (with isAdmin; default false for existing users)
export async function GET(request: NextRequest) {
  try {
    const db = await getDb();
    const users = await db.collection('users').find({}).toArray();
    const normalized = users.map((u: Record<string, unknown>) => ({
      _id: String(u._id ?? ''),
      name: String(u.name ?? ''),
      isAdmin: u.isAdmin === true,
    }));
    return NextResponse.json(normalized);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

// POST - Create a new user or return existing user with same name
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
    const trimmedName = name.trim();

    // Check if user with this name already exists
    const existingUser = await db.collection('users').findOne({
      name: trimmedName,
    });

    if (existingUser) {
      return NextResponse.json({
        _id: existingUser._id.toString(),
        name: existingUser.name,
        createdAt: existingUser.createdAt,
        isAdmin: existingUser.isAdmin === true,
      });
    }

    const hasAnyUser = (await db.collection('users').countDocuments({})) > 0;
    const user = {
      name: trimmedName,
      createdAt: new Date(),
      isAdmin: !hasAnyUser,
    };

    const result = await db.collection('users').insertOne(user);

    return NextResponse.json({
      _id: result.insertedId.toString(),
      name: user.name,
      createdAt: user.createdAt,
      isAdmin: user.isAdmin,
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

