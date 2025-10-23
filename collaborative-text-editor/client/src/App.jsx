import { useState, useEffect, useRef } from 'react';
import { MessageSquare, History, Users, Save, Download } from 'lucide-react';
import './App.css';

function App() {
  // state management
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
  const [saveStatus, setSaveStatus] = useState('');
  
  // refs for WebSocket and text editor
  const ws = useRef(null);
  const textareaRef = useRef(null);
  const reconnectTimeout = useRef(null);

  // initialize connection when username is set
  useEffect(() => {
    if (currentUser) {
      connectToServer();
    }
    
    return () => {
      if (ws.current) {
        ws.current.close();
      }
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
    };
  }, [currentUser]);

  // connect to WebSocket server
  const connectToServer = () => {
    try {
      // connect to backend WebSocket server
      ws.current = new WebSocket('ws://localhost:5000');
      
      ws.current.onopen = () => {
        console.log('✅ Connected to server');
        setIsConnected(true);
        
        // send user join message
        ws.current.send(JSON.stringify({
          type: 'user_join',
          username: currentUser
        }));
      };
      
      ws.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleServerMessage(message);
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      };
      
      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      };
      
      ws.current.onclose = () => {
        console.log('❌ Disconnected from server');
        setIsConnected(false);
        
        // attempt to reconnect after 3 seconds
        reconnectTimeout.current = setTimeout(() => {
          console.log('🔄 Attempting to reconnect...');
          connectToServer();
        }, 3000);
      };
      
    } catch (error) {
      console.error('Failed to connect:', error);
      setIsConnected(false);
    }
  };

  // handle messages from server
  const handleServerMessage = (message) => {
    switch(message.type) {
      case 'init':
        // initial state from server
        if (message.data.document) {
          setDocument(message.data.document.content || '');
          setDocumentTitle(message.data.document.title || 'Untitled Document');
        }
        if (message.data.users) {
          setUsers(message.data.users);
        }
        break;
        
      case 'document_update':
        // another user updated the document
        setDocument(message.data.content);
        break;
        
      case 'title_update':
        // another user updated the title
        setDocumentTitle(message.data.title);
        break;
        
      case 'user_list_update':
        // user list changed
        setUsers(message.data.users);
        break;
        
      case 'chat_message':
        // new chat message
        setMessages(prev => [...prev, message.data.message]);
        break;
        
      case 'save_success':
        setSaveStatus('✅ Saved successfully!');
        setTimeout(() => setSaveStatus(''), 3000);
        break;
        
      case 'save_error':
        setSaveStatus('❌ Save failed');
        setTimeout(() => setSaveStatus(''), 3000);
        break;
        
      default:
        console.log('Unknown message type:', message.type);
    }
  };

  // handle document changes
  const handleDocumentChange = (e) => {
    const newContent = e.target.value;
    setDocument(newContent);
    
    // send changes to server
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: 'document_change',
        content: newContent
      }));
    }
  };

  // handle title change
  const handleTitleChange = (e) => {
    const newTitle = e.target.value;
    setDocumentTitle(newTitle);
    
    // send title change to server
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: 'title_change',
        title: newTitle
      }));
    }
  };

  // text formatting functions
  const formatText = (command) => {
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = document.substring(start, end);
    
    if (!selectedText) {
      alert('Please select text to format');
      return;
    }
    
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
    
    // send to server
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: 'document_change',
        content: newDocument
      }));
    }
    
    // restore cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start, start + formattedText.length);
    }, 0);
  };

  // send chat message
  const sendMessage = () => {
    if (newMessage.trim() && ws.current && ws.current.readyState === WebSocket.OPEN) {
      const message = {
        id: Date.now(),
        user: currentUser,
        text: newMessage,
        timestamp: new Date().toLocaleTimeString()
      };
      
      ws.current.send(JSON.stringify({
        type: 'chat_message',
        message: message
      }));
      
      setNewMessage('');
    }
  };

  // save document to MongoDB
  const saveDocument = () => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      setSaveStatus('💾 Saving...');
      ws.current.send(JSON.stringify({
        type: 'save_document'
      }));
    } else {
      alert('Not connected to server. Please wait for reconnection.');
    }
  };

  // download document
  const downloadDocument = () => {
    const element = document.createElement('a');
    const file = new Blob([document], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `${documentTitle}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // login screen
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

  // main editor interface
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
              onChange={handleTitleChange}
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
            
            {/* Save status */}
            {saveStatus && (
              <span className="status-text" style={{ color: saveStatus.includes('✅') ? '#10b981' : '#ef4444' }}>
                {saveStatus}
              </span>
            )}
            
            {/* Action buttons */}
            <button onClick={saveDocument} className="btn-save" disabled={!isConnected}>
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
              disabled={!isConnected}
            />
          </div>
        </div>

        {/* Chat sidebar */}
        {showChat && (
          <div className="chat-sidebar">
            <div className="chat-header">Chat ({messages.length})</div>
            
            <div className="chat-messages">
              {messages.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#64748b', padding: '20px' }}>
                  No messages yet. Start the conversation!
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className="chat-message">
                    <div className="message-header">
                      <span className="message-user">{msg.user}</span>
                      <span className="message-time">{msg.timestamp}</span>
                    </div>
                    <p className="message-text">{msg.text}</p>
                  </div>
                ))
              )}
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
                  disabled={!isConnected}
                />
                <button 
                  onClick={sendMessage} 
                  className="chat-send-btn"
                  disabled={!isConnected || !newMessage.trim()}
                >
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
            {users.length === 0 ? (
              <span className="footer-label">No users yet</span>
            ) : (
              users.map((user) => (
                <div key={user.id} className="user-badge">
                  <div className="user-color-dot" style={{ backgroundColor: user.color }}></div>
                  <span className="user-name">{user.name}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;