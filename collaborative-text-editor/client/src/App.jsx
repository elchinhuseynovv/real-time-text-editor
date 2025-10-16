import { useState, useEffect, useRef } from 'react';
import { MessageSquare, History, Users, Save, Download } from 'lucide-react';
import './App.css';

function App() {
  // State management
  const [document, setDocument] = useState('');
  const [documentTitle, setDocumentTitle] = useState('Untitled Document');
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [username, setUsername] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  
  // Refs for WebSocket and text editor
  const ws = useRef(null);
  const textareaRef = useRef(null);

  // Initialize connection when username is set
  useEffect(() => {
    if (currentUser) {
      connectToServer();
    }
    
    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [currentUser]);

  // Connect to WebSocket server
  const connectToServer = () => {
    // For now, we'll simulate the connection
    // Later you'll replace this with: ws.current = new WebSocket('ws://localhost:5000');
    
    setIsConnected(true);
    
    // Simulate receiving initial data
    setTimeout(() => {
      setUsers([
        { id: 1, name: currentUser, color: '#3b82f6' },
        { id: 2, name: 'User2', color: '#10b981' }
      ]);
    }, 500);
  };

  // Handle document changes
  const handleDocumentChange = (e) => {
    const newContent = e.target.value;
    setDocument(newContent);
    
    // In real implementation, send changes via WebSocket
    // ws.current.send(JSON.stringify({
    //   type: 'document_change',
    //   content: newContent,
    //   user: currentUser
    // }));
  };

  // Text formatting functions
  const formatText = (command) => {
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = document.substring(start, end);
    
    let formattedText = selectedText;
    switch(command) {
      case 'bold':
        formattedText = `**${selectedText}**`;
        break;
      case 'italic':
        formattedText = `*${selectedText}*`;
        break;
      case 'underline':
        formattedText = `__${selectedText}__`;
        break;
      default:
        break;
    }
    
    const newDocument = document.substring(0, start) + formattedText + document.substring(end);
    setDocument(newDocument);
  };

  // Send chat message
  const sendMessage = () => {
    if (newMessage.trim()) {
      const message = {
        id: Date.now(),
        user: currentUser,
        text: newMessage,
        timestamp: new Date().toLocaleTimeString()
      };
      
      setMessages([...messages, message]);
      setNewMessage('');
      
      // In real implementation:
      // ws.current.send(JSON.stringify({
      //   type: 'chat_message',
      //   message: message
      // }));
    }
  };

  // Save document
  const saveDocument = () => {
    console.log('Saving document:', { title: documentTitle, content: document });
    alert('Document saved! (In real app, this would save to MongoDB)');
  };

  // Download document
  const downloadDocument = () => {
    const element = document.createElement('a');
    const file = new Blob([document], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `${documentTitle}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Login screen
  if (!currentUser) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <h1 className="login-title">CollabEdit</h1>
            <p className="login-subtitle">Real-time Collaborative Text Editor</p>
          </div>
          
          <div className="login-form">
            <div className="form-group">
              <label className="form-label">Enter your name</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="form-input"
                placeholder="Your name"
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && username.trim()) {
                    setCurrentUser(username);
                  }
                }}
              />
            </div>
            
            <button
              onClick={() => username.trim() && setCurrentUser(username)}
              className="btn-primary"
            >
              Join Editor
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main editor interface
  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <div className="header-left">
            <h1 className="app-title">CollabEdit</h1>
            <input
              type="text"
              value={documentTitle}
              onChange={(e) => setDocumentTitle(e.target.value)}
              className="document-title-input"
            />
          </div>
          
          <div className="header-right">
            {/* Connection status */}
            <div className="connection-status">
              <div className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></div>
              <span className="status-text">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            
            {/* Active users */}
            <div className="users-badge">
              <Users className="icon" size={16} />
              <span className="users-count">{users.length}</span>
            </div>
            
            {/* Action buttons */}
            <button onClick={saveDocument} className="btn-save">
              <Save className="icon" size={16} />
              <span>Save</span>
            </button>
            
            <button onClick={downloadDocument} className="btn-download">
              <Download className="icon" size={16} />
              <span>Download</span>
            </button>
          </div>
        </div>
      </header>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-content">
          <button onClick={() => formatText('bold')} className="toolbar-btn bold" title="Bold">
            B
          </button>
          <button onClick={() => formatText('italic')} className="toolbar-btn italic" title="Italic">
            I
          </button>
          <button onClick={() => formatText('underline')} className="toolbar-btn underline" title="Underline">
            U
          </button>
          
          <div className="toolbar-divider"></div>
          
          <button onClick={() => setShowHistory(!showHistory)} className="toolbar-btn">
            <History className="icon" size={16} />
            <span>History</span>
          </button>
          
          <button onClick={() => setShowChat(!showChat)} className="toolbar-btn">
            <MessageSquare className="icon" size={16} />
            <span>Chat</span>
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="main-content">
        {/* Editor */}
        <div className="editor-container">
          <div className="editor-wrapper">
            <textarea
              ref={textareaRef}
              value={document}
              onChange={handleDocumentChange}
              className="editor-textarea"
              placeholder="Start typing your document..."
            />
          </div>
        </div>

        {/* Chat sidebar */}
        {showChat && (
          <div className="chat-sidebar">
            <div className="chat-header">Chat</div>
            
            <div className="chat-messages">
              {messages.map((msg) => (
                <div key={msg.id} className="chat-message">
                  <div className="message-header">
                    <span className="message-user">{msg.user}</span>
                    <span className="message-time">{msg.timestamp}</span>
                  </div>
                  <p className="message-text">{msg.text}</p>
                </div>
              ))}
            </div>
            
            <div className="chat-input-container">
              <div className="chat-input-wrapper">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Type a message..."
                  className="chat-input"
                />
                <button onClick={sendMessage} className="chat-send-btn">
                  Send
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Active users list */}
      <div className="footer">
        <div className="footer-content">
          <span className="footer-label">Active users:</span>
          <div className="active-users">
            {users.map((user) => (
              <div key={user.id} className="user-badge">
                <div className="user-color-dot" style={{ backgroundColor: user.color }}></div>
                <span className="user-name">{user.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;