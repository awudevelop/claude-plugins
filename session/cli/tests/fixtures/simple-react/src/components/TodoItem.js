import React from 'react';

export default function TodoItem({ todo }) {
  return (
    <div className="todo-item">
      <span>{todo.text}</span>
    </div>
  );
}
