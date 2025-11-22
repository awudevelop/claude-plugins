import React, { useState } from 'react';
import Header from './components/Header';
import TodoList from './components/TodoList';

function App() {
  const [todos, setTodos] = useState([]);

  const addTodo = (text) => {
    setTodos([...todos, { id: Date.now(), text, completed: false }]);
  };

  return (
    <div className="App">
      <Header />
      <TodoList todos={todos} onAdd={addTodo} />
    </div>
  );
}

export default App;
