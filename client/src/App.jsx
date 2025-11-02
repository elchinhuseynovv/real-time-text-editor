import { useState, useEffect, useRef } from 'react';
import { MessageSquare, History, Users, Save, Download, Plus, FileText, Clock, ArrowLeft, Trash2 } from 'lucide-react';
import './App.css';

function App() {
  // State management
  const [documentContent, setDocumentContent] = useState('');
  const [documentTitle, setDocumentTitle] = useState('Untitled Document');
  const [documentId, setDocumentId] = useState(null);
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [username, setUsername] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [saveStatus, setSaveStatus] = useState('');
  const [screen, setScreen] = useState('login'); // 'login', 'documents', 'editor'
  const [documents, setDocuments] = useState([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  
  // Refs for WebSocket and text editor
  const ws = useRef(null);
  const textareaRef = useRef(null);
  const reconnectTimeout = useRef(null);

  // Fetch documents when user logs in
  useEffect(() => {
    if (currentUser && screen === 'documents') {
      fetchDocuments();
    }
  }, [currentUser, screen]);

  // Initialize connection when entering editor
  useEffect(() => {
    if (currentUser && screen === 'editor') {
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
  }, [currentUser, screen]);

  // Send document ID when connection is ready and we have a document ID
  useEffect(() => {
    if (isConnected && documentId && ws.current && ws.current.readyState === WebSocket.OPEN) {
      console.log('🔗 Connection ready, sending document ID:', documentId);
      ws.current.send(JSON.stringify({
        type: 'set_document_id',
        documentId: documentId
      }));
    }
  }, [isConnected, documentId]);

  // Fetch documents from backend
  const fetchDocuments = async () => {
    setLoadingDocuments(true);
    try {
      const response = await fetch('http://localhost:5000/api/documents');
      const data = await response.json();
      setDocuments(data);
    } catch (error) {
      console.error('Error fetching documents:', error);
      alert('Failed to fetch documents. Make sure the server is running.');
    } finally {
      setLoadingDocuments(false);
    }
  };

  // Create new document
  const createNewDocument = () => {
    console.log('📝 Creating new document');
    setDocumentContent('');
    setDocumentTitle('Untitled Document');
    setDocumentId(null);
    setMessages([]);
    setScreen('editor');
  };

  // Open existing document
  const openDocument = async (doc) => {
    if (!doc || !doc._id) {
      console.error('❌ Invalid document');
      return;
    }
    
    console.log('📂 Opening document:', doc.title);
    
    // Fetch the latest version from server to ensure we have current data
    try {
      const response = await fetch(`http://localhost:5000/api/documents/${doc._id}`);
      const fullDoc = await response.json();
      
      console.log('✅ Fetched full document:', {
        title: fullDoc.title,
        contentLength: fullDoc.content?.length || 0,
        id: fullDoc._id
      });
      
      // Set all state from the fetched document
      setDocumentContent(fullDoc.content || '');
      setDocumentTitle(fullDoc.title || 'Untitled Document');
      setDocumentId(fullDoc._id);
      setMessages([]);
      
      // Switch to editor after state is set
      setScreen('editor');
      
    } catch (error) {
      console.error('❌ Error fetching document:', error);
      alert('Failed to open document');
    }
  };

  // Delete document
  const deleteDocument = async (docId, docTitle, event) => {
    // Stop event propagation to prevent opening the document
    event.stopPropagation();
    
    // Confirm deletion
    const confirmed = window.confirm(`Are you sure you want to delete "${docTitle}"? This action cannot be undone.`);
    
    if (!confirmed) return;
    
    try {
      const response = await fetch(`http://localhost:5000/api/documents/${docId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        console.log('✅ Document deleted successfully');
        // Refresh the documents list
        fetchDocuments();
      } else {
        throw new Error('Failed to delete document');
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Failed to delete document. Please try again.');
    }
  };

  // Go back to documents list
  const backToDocuments = () => {
    if (ws.current) {
      ws.current.close();
    }
    setIsConnected(false);
    setMessages([]);
    setScreen('documents');
    fetchDocuments();
  };

  // Connect to WebSocket server
  const connectToServer = () => {
    try {
      ws.current = new WebSocket('ws://localhost:5000');
      
      ws.current.onopen = () => {
        console.log('✅ Connected to server');
        setIsConnected(true);
        
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

  // Handle messages from server
  const handleServerMessage = (message) => {
    switch(message.type) {
      case 'init':
        if (message.data.document) {
          setDocumentContent(message.data.document.content || '');
          setDocumentTitle(message.data.document.title || 'Untitled Document');
        }
        if (message.data.users) {
          setUsers(message.data.users);
        }
        break;
        
      case 'document_update':
        setDocumentContent(message.data.content);
        break;
        
      case 'title_update':
        setDocumentTitle(message.data.title);
        break;
        
      case 'user_list_update':
        setUsers(message.data.users);
        break;
        
      case 'chat_message':
        setMessages(prev => [...prev, message.data.message]);
        break;
        
      case 'save_success':
        console.log('✅ Save successful, document ID:', message.data.documentId);
        setSaveStatus('✅ Saved successfully!');
        if (message.data.documentId) {
          const newDocId = message.data.documentId;
          console.log('Current documentId:', documentId, 'New documentId:', newDocId);
          // Always update the document ID from server
          setDocumentId(newDocId);
          
          // Also send it to server to make sure it's stored
          if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({
              type: 'set_document_id',
              documentId: newDocId
            }));
          }
        }
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

  const handleDocumentChange = (e) => {
    const newContent = e.target.value;
    setDocumentContent(newContent);
    
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: 'document_change',
        content: newContent
      }));
    }
  };

  const handleTitleChange = (e) => {
    const newTitle = e.target.value;
    setDocumentTitle(newTitle);
    
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: 'title_change',
        title: newTitle
      }));
    }
  };

  const formatText = (command) => {
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = documentContent.substring(start, end);
    
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
    
    const newContent = documentContent.substring(0, start) + formattedText + documentContent.substring(end);
    setDocumentContent(newContent);
    
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: 'document_change',
        content: newContent
      }));
    }
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start, start + formattedText.length);
    }, 0);
  };

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

  const saveDocument = () => {
    console.log('Save button clicked');
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      console.log('Sending save request to server...');
      setSaveStatus('💾 Saving...');
      ws.current.send(JSON.stringify({
        type: 'save_document'
      }));
    } else {
      console.error('WebSocket not connected');
      setSaveStatus('❌ Not connected');
      alert('Not connected to server. Please wait for reconnection.');
      setTimeout(() => setSaveStatus(''), 3000);
    }
  };

  const downloadDocument = () => {
    try {
      const blob = new Blob([documentContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = `${documentTitle || 'document'}.txt`;
      
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setSaveStatus('✅ Downloaded!');
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download document: ' + error.message);
    }
  };

  // Format date helper
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  // Login screen
  if (screen === 'login') {
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
                    setScreen('documents');
                  }
                }}
              />
            </div>
            
            <button
              onClick={() => {
                if (username.trim()) {
                  setCurrentUser(username);
                  setScreen('documents');
                }
              }}
              className="btn-primary"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Documents list screen
  if (screen === 'documents') {
    return (
      <div className="documents-container">
        <div className="documents-header">
          <div className="documents-header-content">
            <div>
              <h1 className="documents-title">My Documents</h1>
              <p className="documents-subtitle">Welcome back, {currentUser}!</p>
            </div>
            <button onClick={createNewDocument} className="btn-new-document">
              <Plus size={20} />
              <span>New Document</span>
            </button>
          </div>
        </div>

        <div className="documents-content">
          {loadingDocuments ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading documents...</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="empty-state">
              <FileText size={64} className="empty-icon" />
              <h2>No documents yet</h2>
              <p>Create your first document to get started</p>
              <button onClick={createNewDocument} className="btn-primary" style={{ marginTop: '20px' }}>
                <Plus size={20} />
                <span>Create Document</span>
              </button>
            </div>
          ) : (
            <div className="documents-grid">
              {documents.map((doc) => (
                <div key={doc._id} className="document-card">
                  <div className="document-card-header">
                    <FileText size={24} className="document-icon" />
                    <button 
                      className="btn-delete-doc"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteDocument(doc._id, doc.title, e);
                      }}
                      title="Delete document"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                  <div className="document-card-body" onClick={() => openDocument(doc)}>
                    <h3 className="document-card-title">{doc.title}</h3>
                    <p className="document-card-preview">
                      {doc.content ? doc.content.substring(0, 100) + (doc.content.length > 100 ? '...' : '') : 'Empty document'}
                    </p>
                  </div>
                  <div className="document-card-footer" onClick={() => openDocument(doc)}>
                    <div className="document-meta">
                      <Clock size={14} />
                      <span>{formatDate(doc.updatedAt)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Editor screen
  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-content">
          <div className="header-left">
            <button onClick={backToDocuments} className="btn-back" title="Back to documents">
              <ArrowLeft size={20} />
            </button>
            <h1 className="app-title">CollabEdit</h1>
            <input
              type="text"
              value={documentTitle}
              onChange={handleTitleChange}
              className="document-title-input"
            />
          </div>
          
          <div className="header-right">
            <div className="connection-status">
              <div className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></div>
              <span className="status-text">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            
            <div className="users-badge">
              <Users className="icon" size={16} />
              <span className="users-count">{users.length}</span>
            </div>
            
            {saveStatus && (
              <span className="status-text" style={{ color: saveStatus.includes('✅') ? '#10b981' : '#ef4444' }}>
                {saveStatus}
              </span>
            )}
            
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

      <div className="main-content">
        <div className="editor-container">
          <div className="editor-wrapper">
            <textarea
              ref={textareaRef}
              value={documentContent}
              onChange={handleDocumentChange}
              className="editor-textarea"
              placeholder="Start typing your document..."
              disabled={!isConnected}
            />
          </div>
        </div>

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