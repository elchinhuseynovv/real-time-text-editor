import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { MessageSquare, History, Users, Save, Download, Plus, FileText, Clock, ArrowLeft, Trash2, Share2, Copy, Eye, Edit, LogOut } from 'lucide-react';
import './App.css';

// API base URL from environment or default - defined outside component to avoid re-creation
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';

function App() {
  // State management
  const [documentContent, setDocumentContent] = useState('');
  const [documentTitle, setDocumentTitle] = useState('Untitled Document');
  const [documentId, setDocumentId] = useState(null);
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [userToken, setUserToken] = useState(null);
  const [userInfo, setUserInfo] = useState(null); // { id, name, email }
  const [saveStatus, setSaveStatus] = useState('');
  const [screen, setScreen] = useState('login'); // 'login', 'register', 'documents', 'editor'
  // Auth form states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [userRole, setUserRole] = useState(null); // 'owner', 'editor', 'viewer', null
  const [shareLink, setShareLink] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareAccess, setShareAccess] = useState('edit'); // 'read' or 'edit'
  const [shareEmail, setShareEmail] = useState(''); // Email to share with
  const [shareMethod, setShareMethod] = useState('link'); // 'link' or 'email'
  const [sharedUsers, setSharedUsers] = useState([]); // List of users with access
  const [unreadMessages, setUnreadMessages] = useState(0); // Unread message count
  const [savedContent, setSavedContent] = useState(''); // Track saved content
  const [savedTitle, setSavedTitle] = useState(''); // Track saved title
  
  // Refs for Socket.IO and text editor
  const socket = useRef(null);
  const textareaRef = useRef(null);
  const saveStatusTimeout = useRef(null);
  const isMountedRef = useRef(true);
  const handleServerMessageRef = useRef(null); // Ref to latest handleServerMessage
  const documentChangeTimeout = useRef(null); // Debounce timer for document changes
  const documentContentRef = useRef(''); // Ref to track current document content
  const documentTitleRef = useRef(''); // Ref to track current document title

  // Initialize from localStorage and URL on mount
  useEffect(() => {
    // Restore session from localStorage
    const savedToken = localStorage.getItem('collabEdit_token');
    const savedUserInfo = localStorage.getItem('collabEdit_userInfo');
    const savedScreen = localStorage.getItem('collabEdit_screen');
    const savedDocumentId = localStorage.getItem('collabEdit_documentId');
    
    // Check URL for document ID or share token
    const path = window.location.pathname;
    const documentMatch = path.match(/\/document\/([a-f0-9]+)/);
    const shareMatch = path.match(/\/share\/([a-f0-9]+)/);
    
    if (savedToken && savedUserInfo) {
      try {
        const userInfo = JSON.parse(savedUserInfo);
        setUserToken(savedToken);
        setUserInfo(userInfo);
        setCurrentUser(userInfo.email); // Use email as username for compatibility
        
        if (shareMatch && shareMatch[1]) {
          // Share token in URL - will be handled by joinDocumentByToken
          setScreen('documents'); // Go to documents, will join after
        } else if (documentMatch && documentMatch[1]) {
          // Document ID in URL - only navigate if we were on editor screen
          if (savedScreen === 'editor') {
            const docId = documentMatch[1];
            setDocumentId(docId);
            setScreen('editor');
          } else {
            // User was on documents screen, stay there
            setScreen(savedScreen || 'documents');
          }
        } else if (savedScreen === 'editor' && savedDocumentId) {
          // Restore editor state
          setDocumentId(savedDocumentId);
          setScreen('editor');
        } else {
          setScreen(savedScreen || 'documents');
        }
      } catch (error) {
        console.error('Error parsing saved user info:', error);
        // Clear invalid data
        localStorage.removeItem('collabEdit_token');
        localStorage.removeItem('collabEdit_userInfo');
      }
    }
  }, []);
  
  // Save session to localStorage when it changes
  useEffect(() => {
    if (userToken && userInfo) {
      localStorage.setItem('collabEdit_token', userToken);
      localStorage.setItem('collabEdit_userInfo', JSON.stringify(userInfo));
    }
  }, [userToken, userInfo]);
  
  useEffect(() => {
    if (screen !== 'login') {
      localStorage.setItem('collabEdit_screen', screen);
    }
  }, [screen]);
  
  useEffect(() => {
    if (documentId) {
      localStorage.setItem('collabEdit_documentId', documentId);
      // Update URL
      window.history.pushState({}, '', `/document/${documentId}`);
    } else if (screen === 'documents') {
      window.history.pushState({}, '', '/documents');
    }
  }, [documentId, screen]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (saveStatusTimeout.current) {
        clearTimeout(saveStatusTimeout.current);
      }
      if (socket.current) {
        socket.current.disconnect();
      }
    };
  }, []);

  // Fetch documents from backend - memoized to avoid dependency issues
  const fetchDocuments = useCallback(async () => {
    if (!userToken) return;
    
    setLoadingDocuments(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/documents`, {
        headers: {
          'Authorization': `Bearer ${userToken}`
        }
      });
      if (!response.ok) {
        if (response.status === 401) {
          // Token expired or invalid
          handleLogout();
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (isMountedRef.current) {
      setDocuments(data);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
      if (isMountedRef.current) {
      alert('Failed to fetch documents. Make sure the server is running.');
      }
    } finally {
      if (isMountedRef.current) {
      setLoadingDocuments(false);
      }
    }
  }, [userToken]);

  // Handle messages from server - defined early to avoid hoisting issues
  const handleServerMessage = useCallback((type, data) => {
    switch(type) {
      case 'init':
        if (data.document) {
          setDocumentContent(data.document.content || '');
          setDocumentTitle(data.document.title || 'Untitled Document');
          // Update saved state
          setSavedContent(data.document.content || '');
          setSavedTitle(data.document.title || 'Untitled Document');
        }
        if (data.users) {
          setUsers(data.users);
        }
        break;
        
      case 'document_update':
        // Update document content immediately when received from Socket.IO
        if (data.content !== undefined) {
          setDocumentContent(data.content);
          // Don't update savedContent here - only update on save or init
        }
        break;
        
      case 'document_operation':
        // Handle CRDT-based operations for real-time updates
        if (data.content !== undefined) {
          setDocumentContent(data.content);
          // Don't update savedContent here - only update on save or init
        }
        break;
        
      case 'title_update':
        setDocumentTitle(data.title);
        break;
        
      case 'user_list_update':
        setUsers(data.users);
        break;
        
      case 'chat_message':
        setMessages(prev => [...prev, data.message]);
        // Increment unread count if chat is not open
        setUnreadMessages(prev => showChat ? 0 : prev + 1);
        break;
        
      case 'save_success':
        console.log('✅ Save successful, document ID:', data.documentId);
        if (saveStatusTimeout.current) {
          clearTimeout(saveStatusTimeout.current);
        }
        setSaveStatus('✅ Saved successfully!');
        if (data.documentId) {
          const newDocId = data.documentId;
          console.log('Current documentId:', documentId, 'New documentId:', newDocId);
          
          // If this is a new document (documentId was null), set user role to owner
          setDocumentId(prevId => {
            if (!prevId && userToken) {
              setUserRole('owner');
            }
            return newDocId;
          });
          
          // Update URL
          window.history.pushState({}, '', `/document/${newDocId}`);
          
          // Update saved state using refs to get current values
          setSavedContent(documentContentRef.current);
          setSavedTitle(documentTitleRef.current);
          
          // Note: Server will send 'init' message automatically after creating new document
          // so we don't need to send set_document_id here
        }
        saveStatusTimeout.current = setTimeout(() => {
          if (isMountedRef.current) {
            setSaveStatus('');
          }
        }, 3000);
        break;
        
      case 'save_error':
        if (saveStatusTimeout.current) {
          clearTimeout(saveStatusTimeout.current);
        }
        setSaveStatus(`❌ Save failed: ${data?.message || 'Unknown error'}`);
        saveStatusTimeout.current = setTimeout(() => {
          if (isMountedRef.current) {
            setSaveStatus('');
          }
        }, 3000);
        break;
      
      case 'error':
        console.error('Server error:', data?.message);
        if (isMountedRef.current) {
          alert(`Error: ${data?.message || 'Unknown error'}`);
        }
        break;
        
      default:
        console.log('Unknown message type:', type);
    }
  }, [documentId, showChat, userToken]); // Removed documentContent and documentTitle from dependencies
  
  // Update ref whenever handleServerMessage changes
  useEffect(() => {
    handleServerMessageRef.current = handleServerMessage;
  }, [handleServerMessage]);
  
  // Update refs when content/title changes
  useEffect(() => {
    documentContentRef.current = documentContent;
  }, [documentContent]);
  
  useEffect(() => {
    documentTitleRef.current = documentTitle;
  }, [documentTitle]);

  // Connect to Socket.IO server - defined early to avoid hoisting issues
  const connectToServer = useCallback(() => {
    // Don't connect if component unmounted
    if (!isMountedRef.current) {
      return;
    }
    
    // Don't connect if not in editor screen or no token
    if (screen !== 'editor' || !userToken) {
      return;
    }
    
    // Don't reconnect if already connected
    if (socket.current && socket.current.connected) {
      return;
    }

    // Disconnect existing socket if any
    if (socket.current) {
      socket.current.disconnect();
      socket.current = null;
    }

    try {
      console.log('🔌 Connecting to Socket.IO server...');
      socket.current = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: Infinity,
        timeout: 20000,
        autoConnect: true,
        auth: {
          token: userToken || undefined,
          username: currentUser || undefined, // Fallback for backward compatibility
        },
        extraHeaders: userToken ? {
          'Authorization': `Bearer ${userToken}`
        } : {}
      });
      
      socket.current.on('connect', () => {
        if (!isMountedRef.current) {
          socket.current?.disconnect();
          return;
        }
        console.log('✅ Connected to server');
        setIsConnected(true);
        
        // Send user join message (username will be extracted from token if available)
        if (socket.current && socket.current.connected && currentUser) {
          socket.current.emit('user_join', { username: currentUser });
        }
      });
      
      socket.current.on('disconnect', (reason) => {
        if (!isMountedRef.current) return;
        
        console.log('❌ Disconnected from server:', reason);
        setIsConnected(false);
        
        // Only manually reconnect if server disconnected us, not if client disconnected
        // Socket.IO will handle automatic reconnection for other cases
        if (reason === 'io server disconnect') {
          // Server disconnected, reconnect manually after delay
          setTimeout(() => {
            if (isMountedRef.current && screen === 'editor' && userToken && (!socket.current || !socket.current.connected)) {
              connectToServer();
            }
          }, 1000);
        }
        // For 'io client disconnect', don't reconnect - it was intentional
      });
      
      socket.current.on('connect_error', (error) => {
        console.error('Socket.IO connection error:', error);
        if (isMountedRef.current) {
          setIsConnected(false);
        }
      });
      
      // Register all event handlers only once
      // Remove any existing listeners first to prevent duplicates
      socket.current.removeAllListeners('init');
      socket.current.removeAllListeners('document_update');
      socket.current.removeAllListeners('document_operation');
      socket.current.removeAllListeners('title_update');
      socket.current.removeAllListeners('user_list_update');
      socket.current.removeAllListeners('chat_message');
      socket.current.removeAllListeners('save_success');
      socket.current.removeAllListeners('save_error');
      socket.current.removeAllListeners('error');
      
      // Use ref to access latest handleServerMessage without recreating connection
      socket.current.on('init', (data) => handleServerMessageRef.current?.('init', data));
      socket.current.on('document_update', (data) => handleServerMessageRef.current?.('document_update', data));
      socket.current.on('document_operation', (data) => handleServerMessageRef.current?.('document_operation', data));
      socket.current.on('title_update', (data) => handleServerMessageRef.current?.('title_update', data));
      socket.current.on('user_list_update', (data) => handleServerMessageRef.current?.('user_list_update', data));
      socket.current.on('chat_message', (data) => handleServerMessageRef.current?.('chat_message', data));
      socket.current.on('save_success', (data) => handleServerMessageRef.current?.('save_success', data));
      socket.current.on('save_error', (data) => handleServerMessageRef.current?.('save_error', data));
      socket.current.on('error', (data) => handleServerMessageRef.current?.('error', data));
      
    } catch (error) {
      console.error('Failed to connect:', error);
      if (isMountedRef.current) {
        setIsConnected(false);
        socket.current = null;
      }
    }
  }, [userToken, screen]); // Removed handleServerMessage from dependencies

  // Fetch documents when user logs in
  useEffect(() => {
    if (userToken && screen === 'documents') {
      fetchDocuments();
    }
  }, [userToken, screen, fetchDocuments]);

  // Initialize connection when entering editor
  useEffect(() => {
    if (userToken && screen === 'editor') {
      connectToServer();
    }
    
    return () => {
      // Clear debounce timer
      if (documentChangeTimeout.current) {
        clearTimeout(documentChangeTimeout.current);
        documentChangeTimeout.current = null;
      }
      
      // Disconnect socket only when leaving editor screen
      if (socket.current && screen !== 'editor') {
        socket.current.disconnect();
        socket.current = null;
        setIsConnected(false);
      }
    };
  }, [userToken, screen, connectToServer]);

  // Send document ID when connection is ready and we have a document ID
  useEffect(() => {
    if (isConnected && documentId && socket.current && socket.current.connected) {
      // Don't send if we just received save_success (server will send init)
      // Check if this is a new document by checking if content is empty
      const isNewDocument = !documentContent || documentContent.length === 0;
      
      if (!isNewDocument) {
        console.log('🔗 Connection ready, sending document ID:', documentId);
        // Use a small delay to ensure connection is fully established
        const timeoutId = setTimeout(() => {
          if (socket.current && socket.current.connected && documentId) {
            socket.current.emit('set_document_id', { documentId: documentId });
          }
        }, 500);
        
        return () => clearTimeout(timeoutId);
      }
    }
  }, [isConnected, documentId, documentContent]);

  // Load document when documentId is set (e.g., from URL or after save)
  useEffect(() => {
    if (documentId && userToken && screen === 'editor' && isConnected) {
      // Only load if we don't have content yet (new document or loaded from URL)
      const hasContent = documentContent && documentContent.length > 0;
      const isUntitled = documentTitle === 'Untitled Document';
      
      if (!hasContent && isUntitled) {
        console.log('📄 Loading document from server:', documentId);
        openDocument({ _id: documentId }).catch(err => {
          console.error('Error loading document:', err);
        });
      }
    }
  }, [documentId, currentUser, screen, isConnected]);

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
      const response = await fetch(`${API_BASE_URL}/api/documents/${doc._id}`, {
        headers: {
          'Authorization': `Bearer ${userToken}`
        }
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const fullDoc = await response.json();
      
      console.log('✅ Fetched full document:', {
        title: fullDoc.title,
        contentLength: fullDoc.content?.length || 0,
        id: fullDoc._id
      });
      
      // Determine user role
      let role = null;
      if (fullDoc.owner === currentUser) {
        role = 'owner';
      } else {
        const permission = fullDoc.permissions?.find(p => p.username === currentUser);
        role = permission ? permission.role : null;
      }
      setUserRole(role);
      
      // Set all state from the fetched document
      if (isMountedRef.current) {
        setDocumentContent(fullDoc.content || '');
        setDocumentTitle(fullDoc.title || 'Untitled Document');
        setDocumentId(fullDoc._id);
        setMessages([]);
        
        // Update saved state
        setSavedContent(fullDoc.content || '');
        setSavedTitle(fullDoc.title || 'Untitled Document');
        
        // Update URL
        window.history.pushState({}, '', `/document/${fullDoc._id}`);
        
        // Switch to editor after state is set
        setScreen('editor');
      }
      
    } catch (error) {
      console.error('❌ Error fetching document:', error);
      if (isMountedRef.current) {
        alert('Failed to open document. Please try again.');
        // Go back to documents if error
        setScreen('documents');
      }
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
      const response = await fetch(`${API_BASE_URL}/api/documents/${docId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${userToken}`
        }
      });
      
      if (response.ok) {
        console.log('✅ Document deleted successfully');
        // Refresh the documents list
        fetchDocuments();
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to delete document: ${response.status}`);
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      if (isMountedRef.current) {
        alert(`Failed to delete document: ${error.message}`);
      }
    }
  };

  // Register function
  const handleRegister = async (e) => {
    e?.preventDefault();
    setAuthError('');
    setIsLoading(true);

    if (!registerName.trim() || !registerEmail.trim() || !registerPassword.trim()) {
      setAuthError('All fields are required');
      setIsLoading(false);
      return;
    }

    if (registerPassword.length < 6) {
      setAuthError('Password must be at least 6 characters long');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: registerName.trim(),
          email: registerEmail.trim().toLowerCase(),
          password: registerPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      // Save token and user info
      setUserToken(data.token);
      setUserInfo(data.user);
      setCurrentUser(data.user.email);
      setScreen('documents');
      
      // Clear form
      setRegisterName('');
      setRegisterEmail('');
      setRegisterPassword('');
    } catch (error) {
      console.error('Registration error:', error);
      setAuthError(error.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Login function
  const handleLogin = async (e) => {
    e?.preventDefault();
    setAuthError('');
    setIsLoading(true);

    if (!loginEmail.trim() || !loginPassword.trim()) {
      setAuthError('Email and password are required');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: loginEmail.trim().toLowerCase(),
          password: loginPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Save token and user info
      setUserToken(data.token);
      setUserInfo(data.user);
      setCurrentUser(data.user.email);
      setScreen('documents');
      
      // Clear form
      setLoginEmail('');
      setLoginPassword('');
    } catch (error) {
      console.error('Login error:', error);
      setAuthError(error.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function
  const handleLogout = async () => {
    try {
      // Call logout endpoint if token exists
      if (userToken) {
        await fetch(`${API_BASE_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${userToken}`
          }
        }).catch(err => console.error('Logout API error:', err));
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Close Socket.IO connection
      if (socket.current) {
        socket.current.disconnect();
        socket.current = null;
      }
      
      // Clear localStorage
      localStorage.removeItem('collabEdit_token');
      localStorage.removeItem('collabEdit_userInfo');
      localStorage.removeItem('collabEdit_screen');
      localStorage.removeItem('collabEdit_documentId');
      
      // Reset state
      setCurrentUser(null);
      setUserToken(null);
      setUserInfo(null);
      setScreen('login');
      setDocumentId(null);
      setDocumentContent('');
      setDocumentTitle('Untitled Document');
      setDocuments([]);
      setMessages([]);
      setIsConnected(false);
      setUserRole(null);
      
      // Reset URL
      window.history.pushState({}, '', '/');
    }
  };

  // Go back to documents list
  const backToDocuments = () => {
    if (socket.current) {
      socket.current.disconnect();
      socket.current = null;
    }
    setIsConnected(false);
    setMessages([]);
    setScreen('documents');
    fetchDocuments();
  };

  const handleDocumentChange = (e) => {
    // Check if user has write permission
    if (userRole === 'viewer') {
      return; // Don't allow changes for viewers
    }
    
    const newContent = e.target.value;
    setDocumentContent(newContent);
    
    // Debounce Socket.IO updates to prevent lag when typing fast
    // Clear previous timeout
    if (documentChangeTimeout.current) {
      clearTimeout(documentChangeTimeout.current);
    }
    
    // Send update via Socket.IO for real-time collaboration (debounced)
    if (socket.current && socket.current.connected && documentId) {
      // Send immediately for small changes, debounce for larger content
      const contentLength = newContent.length;
      const delay = contentLength > 1000 ? 150 : 50; // Longer delay for larger documents
      
      documentChangeTimeout.current = setTimeout(() => {
        if (socket.current && socket.current.connected && documentId) {
          socket.current.emit('document_change', { content: newContent });
        }
      }, delay);
    }
  };

  const handleTitleChange = (e) => {
    // Check if user has write permission
    if (userRole === 'viewer') {
      return; // Don't allow title changes for viewers
    }
    
    const newTitle = e.target.value;
    setDocumentTitle(newTitle);
    
    if (socket.current && socket.current.connected) {
      socket.current.emit('title_change', { title: newTitle });
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
    
    if (socket.current && socket.current.connected && documentId) {
      socket.current.emit('document_change', { content: newContent });
    }
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start, start + formattedText.length);
    }, 0);
  };

  const sendMessage = () => {
    if (newMessage.trim() && socket.current && socket.current.connected && documentId) {
      const message = {
        id: Date.now(),
        text: newMessage.trim(),
        timestamp: new Date().toLocaleTimeString()
      };
      
      socket.current.emit('chat_message', { message: message });
      
      setNewMessage('');
    }
  };

  const saveDocument = () => {
    // Prevent saving if documentId exists and we're trying to create a new document
    if (documentId) {
      // This is an existing document, just save it
      console.log('Save button clicked for existing document');
    } else {
      // This is a new document, but check if we already have a pending save
      console.log('Save button clicked for new document');
    }
    
    if (socket.current && socket.current.connected) {
      console.log('Sending save request to server...');
      if (saveStatusTimeout.current) {
        clearTimeout(saveStatusTimeout.current);
      }
      setSaveStatus('💾 Saving...');
      
      // Only send content/title if this is a new document (no documentId)
      // For existing documents, server will use CRDT content
      if (documentId) {
        socket.current.emit('save_document', {});
      } else {
        socket.current.emit('save_document', {
          content: documentContent,
          title: documentTitle
        });
      }
    } else {
      console.error('Socket.IO not connected');
      if (saveStatusTimeout.current) {
        clearTimeout(saveStatusTimeout.current);
      }
      setSaveStatus('❌ Not connected');
      if (isMountedRef.current) {
        alert('Not connected to server. Please wait for reconnection.');
        saveStatusTimeout.current = setTimeout(() => {
          if (isMountedRef.current) {
            setSaveStatus('');
          }
        }, 3000);
      }
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
      
      if (saveStatusTimeout.current) {
        clearTimeout(saveStatusTimeout.current);
      }
      setSaveStatus('✅ Downloaded!');
      saveStatusTimeout.current = setTimeout(() => {
        if (isMountedRef.current) {
          setSaveStatus('');
        }
      }, 2000);
    } catch (error) {
      console.error('Download error:', error);
      if (isMountedRef.current) {
      alert('Failed to download document: ' + error.message);
      }
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

  // Generate share link
  const generateShareLink = async () => {
    if (!documentId) {
      alert('Please save the document first before sharing');
      return;
    }

    try {
      // Fetch document to get current permissions and share link
      const docResponse = await fetch(`${API_BASE_URL}/api/documents/${documentId}`, {
        headers: {
          'Authorization': `Bearer ${userToken}`
        }
      });
      
      if (docResponse.ok) {
        const doc = await docResponse.json();
        // Set share link if exists
        if (doc.shareToken) {
          const baseUrl = window.location.origin;
          setShareLink(`${baseUrl}/share/${doc.shareToken}`);
        }
        // Set shared users from permissions
        setSharedUsers(doc.permissions || []);
      }
      
      // Generate or update share link
      const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`
        },
        body: JSON.stringify({ access: shareAccess })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate share link');
      }

      const data = await response.json();
      setShareLink(data.shareUrl);
      
      // Refresh document to get updated permissions
      const refreshResponse = await fetch(`${API_BASE_URL}/api/documents/${documentId}`, {
        headers: {
          'Authorization': `Bearer ${userToken}`
        }
      });
      if (refreshResponse.ok) {
        const refreshedDoc = await refreshResponse.json();
        setSharedUsers(refreshedDoc.permissions || []);
      }
      
      setShowShareModal(true);
    } catch (error) {
      console.error('Error generating share link:', error);
      alert('Failed to generate share link: ' + error.message);
    }
  };

  // Copy share link to clipboard
  const copyShareLink = () => {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink).then(() => {
        alert('Share link copied to clipboard!');
      }).catch(err => {
        console.error('Failed to copy:', err);
        alert('Failed to copy link');
      });
    }
  };

  // Revoke share link
  const revokeShareLink = async () => {
    if (!documentId) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}/share`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${userToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to revoke share link');
      }

      setShareLink(null);
      setShowShareModal(false);
      alert('Share link revoked successfully');
    } catch (error) {
      console.error('Error revoking share link:', error);
      alert('Failed to revoke share link: ' + error.message);
    }
  };

  // Share document by email
  const shareByEmail = async () => {
    if (!documentId) {
      alert('Please save the document first before sharing');
      return;
    }

    if (!shareEmail.trim()) {
      alert('Please enter an email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(shareEmail.trim())) {
      alert('Please enter a valid email address');
      return;
    }

    try {
      // Determine role based on access level
      const role = shareAccess === 'edit' ? 'editor' : 'viewer';
      
      const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}/permissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`
        },
        body: JSON.stringify({ email: shareEmail.trim().toLowerCase(), role })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to share document');
      }

      alert(`Document shared with ${shareEmail.trim()} successfully!`);
      setShareEmail('');
      
      // Refresh document to get updated permissions
      const refreshResponse = await fetch(`${API_BASE_URL}/api/documents/${documentId}`, {
        headers: {
          'Authorization': `Bearer ${userToken}`
        }
      });
      if (refreshResponse.ok) {
        const refreshedDoc = await refreshResponse.json();
        setSharedUsers(refreshedDoc.permissions || []);
      }
      
      // Refresh documents list to show shared documents
      fetchDocuments();
    } catch (error) {
      console.error('Error sharing document:', error);
      alert('Failed to share document: ' + error.message);
    }
  };

  // Join document via share token
  const joinDocumentByToken = async (token) => {
    if (!userToken) {
      alert('Please login first');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/documents/share/${token}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${userToken}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to join document');
      }

      const data = await response.json();
      
      // Set user role based on access
      if (data.access === 'read') {
        setUserRole('viewer');
      } else if (data.access === 'edit') {
        setUserRole('editor');
      }

      // Open the document
      await openDocument({ _id: data.documentId, title: data.title });
      
      // Remove token from URL
      window.history.replaceState({}, '', `/document/${data.documentId}`);
    } catch (error) {
      console.error('Error joining document:', error);
      alert('Failed to join document: ' + error.message);
    }
  };

  // Check for share token in URL on mount
  useEffect(() => {
    const path = window.location.pathname;
    const shareMatch = path.match(/\/share\/([a-f0-9]+)/);
    if (shareMatch && shareMatch[1]) {
      const token = shareMatch[1];
      // Wait for user to login, then join
      if (userToken) {
        joinDocumentByToken(token).catch(err => {
          console.error('Error joining document:', err);
        });
      }
    }
  }, [userToken]);

  // Login/Register screens
  if (screen === 'login' || screen === 'register') {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <h1 className="login-title">CollabEdit</h1>
            <p className="login-subtitle">Real-time Collaborative Text Editor</p>
          </div>
          
          {screen === 'login' ? (
            <div className="login-form">
              <h2 style={{ marginBottom: '32px', fontSize: '24px', fontWeight: '600', textAlign: 'center', color: '#e2e8f0' }}>Sign in</h2>
              
              {authError && (
                <div style={{
                  padding: '12px',
                  marginBottom: '16px',
                  background: '#fee2e2',
                  color: '#dc2626',
                  borderRadius: '8px',
                  fontSize: '14px',
                  textAlign: 'center'
                }}>
                  {authError}
                </div>
              )}
              
              <form onSubmit={handleLogin}>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="form-input"
                    placeholder="your.email@example.com"
                    required
                    disabled={isLoading}
                  />
                </div>
                
                <div className="form-group" style={{ marginTop: '24px' }}>
                  <label className="form-label">Password</label>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="form-input"
                    placeholder="Enter your password"
                    required
                    disabled={isLoading}
                    minLength={6}
                  />
                </div>
                
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isLoading}
                  style={{ width: '100%', marginTop: '32px' }}
                >
                  {isLoading ? 'Signing in...' : 'Sign in'}
                </button>
              </form>
              
              <div style={{ marginTop: '24px', textAlign: 'center' }}>
                <p style={{ color: '#94a3b8', fontSize: '14px' }}>
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setScreen('register');
                      setAuthError('');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#3b82f6',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      fontSize: '14px'
                    }}
                  >
                    Sign up
                  </button>
                </p>
              </div>
            </div>
          ) : (
            <div className="login-form">
              <h2 style={{ marginBottom: '32px', fontSize: '24px', fontWeight: '600', textAlign: 'center', color: '#e2e8f0' }}>Sign up</h2>
              
              {authError && (
                <div style={{
                  padding: '12px',
                  marginBottom: '16px',
                  background: '#fee2e2',
                  color: '#dc2626',
                  borderRadius: '8px',
                  fontSize: '14px',
                  textAlign: 'center'
                }}>
                  {authError}
                </div>
              )}
              
              <form onSubmit={handleRegister}>
                <div className="form-group">
                  <label className="form-label">Name</label>
                  <input
                    type="text"
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    className="form-input"
                    placeholder="Your full name"
                    required
                    disabled={isLoading}
                  />
                </div>
                
                <div className="form-group" style={{ marginTop: '24px' }}>
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    className="form-input"
                    placeholder="your.email@example.com"
                    required
                    disabled={isLoading}
                  />
                </div>
                
                <div className="form-group" style={{ marginTop: '24px' }}>
                  <label className="form-label">Password</label>
                  <input
                    type="password"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    className="form-input"
                    placeholder="Minimum 6 characters"
                    required
                    disabled={isLoading}
                    minLength={6}
                  />
                </div>
                
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isLoading}
                  style={{ width: '100%', marginTop: '32px' }}
                >
                  {isLoading ? 'Signing up...' : 'Sign up'}
                </button>
              </form>
              
              <div style={{ marginTop: '24px', textAlign: 'center' }}>
                <p style={{ color: '#94a3b8', fontSize: '14px' }}>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setScreen('login');
                      setAuthError('');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#3b82f6',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      fontSize: '14px'
                    }}
                  >
                    Sign in
                  </button>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Documents list screen
  if (screen === 'documents') {
    // Separate documents into owned and shared
    const ownedDocuments = documents.filter(doc => doc.owner === currentUser);
    const sharedDocuments = documents.filter(doc => doc.owner !== currentUser);
    
    return (
      <div className="documents-container">
        <div className="documents-header">
          <div className="documents-header-content">
            <div>
              <h1 className="documents-title">My Documents</h1>
              <p className="documents-subtitle">Welcome back, {userInfo?.name || currentUser}!</p>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button onClick={createNewDocument} className="btn-new-document">
                <Plus size={20} />
                <span>New Document</span>
              </button>
              <button onClick={handleLogout} className="btn-logout" style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#ef4444',
                color: 'white',
                padding: '10px 20px',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.background = '#dc2626'}
              onMouseLeave={(e) => e.target.style.background = '#ef4444'}
              >
                <LogOut size={18} />
                <span>Logout</span>
              </button>
            </div>
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
            <div>
              {/* Owned Documents Section */}
              {ownedDocuments.length > 0 && (
                <div style={{ marginBottom: '40px' }}>
                  <h2 style={{ 
                    fontSize: '24px', 
                    fontWeight: '600', 
                    color: '#f1f5f9', 
                    marginBottom: '20px',
                    paddingBottom: '12px',
                    borderBottom: '2px solid #334155'
                  }}>
                    Owned Documents
                  </h2>
                  <div className="documents-grid">
                    {ownedDocuments.map((doc) => (
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
                </div>
              )}

              {/* Shared Documents Section */}
              {sharedDocuments.length > 0 && (
                <div>
                  <h2 style={{ 
                    fontSize: '24px', 
                    fontWeight: '600', 
                    color: '#f1f5f9', 
                    marginBottom: '20px',
                    paddingBottom: '12px',
                    borderBottom: '2px solid #334155'
                  }}>
                    Shared with Me
                  </h2>
                  <div className="documents-grid">
                    {sharedDocuments.map((doc) => {
                      const permission = doc.permissions?.find(p => p.username === currentUser);
                      const role = permission ? permission.role : 'viewer';
                      
                      return (
                        <div key={doc._id} className="document-card">
                          <div className="document-card-header">
                            <FileText size={24} className="document-icon" />
                            {/* No delete button for shared documents */}
                          </div>
                          <div className="document-card-body" onClick={() => openDocument(doc)}>
                            <h3 className="document-card-title">{doc.title}</h3>
                            <p className="document-card-preview">
                              {doc.content ? doc.content.substring(0, 100) + (doc.content.length > 100 ? '...' : '') : 'Empty document'}
                            </p>
                            <div style={{ 
                              marginTop: '8px', 
                              fontSize: '12px', 
                              color: '#94a3b8',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              <span>Owner: {doc.owner}</span>
                              <span>•</span>
                              <span>Access: {role === 'editor' ? 'Can Edit' : 'Read Only'}</span>
                            </div>
                          </div>
                          <div className="document-card-footer" onClick={() => openDocument(doc)}>
                            <div className="document-meta">
                              <Clock size={14} />
                              <span>{formatDate(doc.updatedAt)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
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
              disabled={userRole === 'viewer'}
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
            
            <button onClick={saveDocument} className="btn-save" disabled={
              !isConnected || 
              userRole === 'viewer' || 
              (documentContent === savedContent && documentTitle === savedTitle && documentId)
            }>
              <Save className="icon" size={16} />
              <span>Save</span>
            </button>
            
            {userRole === 'owner' && (
              <button onClick={generateShareLink} className="btn-share">
                <Share2 className="icon" size={16} />
                <span>Share</span>
              </button>
            )}
            
            <button onClick={downloadDocument} className="btn-download">
              <Download className="icon" size={16} />
              <span>Download</span>
            </button>
            
            <button onClick={handleLogout} className="btn-logout" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: '#ef4444',
              color: 'white',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.background = '#dc2626'}
            onMouseLeave={(e) => e.target.style.background = '#ef4444'}
            >
              <LogOut size={18} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      <div className="toolbar">
        <div className="toolbar-content">
          <button onClick={() => formatText('bold')} className="toolbar-btn bold" title="Bold" disabled={userRole === 'viewer'}>
            B
          </button>
          <button onClick={() => formatText('italic')} className="toolbar-btn italic" title="Italic" disabled={userRole === 'viewer'}>
            I
          </button>
          <button onClick={() => formatText('underline')} className="toolbar-btn underline" title="Underline" disabled={userRole === 'viewer'}>
            U
          </button>
          
          <div className="toolbar-divider"></div>
          
          {userRole === 'viewer' && (
            <span className="viewer-badge" style={{ marginLeft: '10px', padding: '4px 12px', background: '#fbbf24', color: '#000', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
              <Eye size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
              Read Only
            </span>
          )}
          
          {userRole === 'editor' && (
            <span className="editor-badge" style={{ marginLeft: '10px', padding: '4px 12px', background: '#3b82f6', color: '#fff', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
              <Edit size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
              Editor
            </span>
          )}
          
          <div className="toolbar-divider"></div>
          
          <button onClick={() => setShowHistory(!showHistory)} className="toolbar-btn">
            <History className="icon" size={16} />
            <span>History</span>
          </button>
          
          {users.length > 1 && (
            <button 
              onClick={() => {
                setShowChat(!showChat);
                if (!showChat) {
                  // Clear unread count when opening chat
                  setUnreadMessages(0);
                }
              }} 
              className="toolbar-btn"
              style={{ position: 'relative' }}
            >
              <MessageSquare className="icon" size={16} />
              <span>Chat</span>
              {unreadMessages > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  background: '#ef4444',
                  color: 'white',
                  borderRadius: '50%',
                  width: '20px',
                  height: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 'bold'
                }}>
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </span>
              )}
            </button>
          )}
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
              placeholder={userRole === 'viewer' ? 'You have read-only access to this document...' : 'Start typing your document...'}
              disabled={!isConnected || userRole === 'viewer'}
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
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
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
        
        {showShareModal && (
          <div className="modal-overlay" onClick={() => setShowShareModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Share Document</h2>
                <button className="modal-close" onClick={() => setShowShareModal(false)}>×</button>
              </div>
              <div className="modal-body">
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Share Method:</label>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        value="link"
                        checked={shareMethod === 'link'}
                        onChange={(e) => setShareMethod(e.target.value)}
                        style={{ marginRight: '6px' }}
                      />
                      Share Link
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        value="email"
                        checked={shareMethod === 'email'}
                        onChange={(e) => setShareMethod(e.target.value)}
                        style={{ marginRight: '6px' }}
                      />
                      Share by Email
                    </label>
                  </div>
                </div>
                
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Access Level:</label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        value="read"
                        checked={shareAccess === 'read'}
                        onChange={(e) => setShareAccess(e.target.value)}
                        style={{ marginRight: '6px' }}
                      />
                      <Eye size={16} style={{ marginRight: '4px' }} />
                      Read Only
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        value="edit"
                        checked={shareAccess === 'edit'}
                        onChange={(e) => setShareAccess(e.target.value)}
                        style={{ marginRight: '6px' }}
                      />
                      <Edit size={16} style={{ marginRight: '4px' }} />
                      Can Edit
                    </label>
                  </div>
                </div>
                
                {shareMethod === 'email' ? (
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Email:</label>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                      <input
                        type="email"
                        value={shareEmail}
                        onChange={(e) => setShareEmail(e.target.value)}
                        placeholder="user@example.com"
                        style={{
                          flex: 1,
                          padding: '8px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '14px'
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            shareByEmail();
                          }
                        }}
                      />
                      <button
                        onClick={shareByEmail}
                        disabled={!shareEmail.trim()}
                        style={{
                          padding: '8px 16px',
                          background: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: shareEmail.trim() ? 'pointer' : 'not-allowed',
                          opacity: shareEmail.trim() ? 1 : 0.5
                        }}
                      >
                        Share
                      </button>
                    </div>
                    
                    {/* Show shared users list */}
                    {sharedUsers.length > 0 && (
                      <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #e5e7eb' }}>
                        <label style={{ display: 'block', marginBottom: '12px', fontWeight: 'bold' }}>Shared Users:</label>
                        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                          {sharedUsers.map((perm, index) => (
                            <div key={index} style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '8px 12px',
                              marginBottom: '8px',
                              background: '#f3f4f6',
                              borderRadius: '6px'
                            }}>
                              <span style={{ fontWeight: '500', color: '#1f2937' }}>{perm.username}</span>
                              {userRole === 'owner' && (
                                <select
                                  value={perm.role}
                                  onChange={async (e) => {
                                    const newRole = e.target.value;
                                    try {
                                      const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}/permissions`, {
                                        method: 'POST',
                                        headers: {
                                          'Content-Type': 'application/json',
                                          'Authorization': `Bearer ${userToken}`
                                        },
                                        body: JSON.stringify({ email: perm.username, role: newRole })
                                      });
                                      if (response.ok) {
                                        // Refresh shared users list
                                        const refreshResponse = await fetch(`${API_BASE_URL}/api/documents/${documentId}`, {
                                          headers: { 'Authorization': `Bearer ${userToken}` }
                                        });
                                        if (refreshResponse.ok) {
                                          const refreshedDoc = await refreshResponse.json();
                                          setSharedUsers(refreshedDoc.permissions || []);
                                        }
                                      } else {
                                        const error = await response.json();
                                        throw new Error(error.error || 'Failed to update access');
                                      }
                                    } catch (error) {
                                      console.error('Error updating user access:', error);
                                      alert('Failed to update user access: ' + error.message);
                                    }
                                  }}
                                  style={{
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    background: perm.role === 'editor' ? '#3b82f6' : '#6b7280',
                                    color: 'white',
                                    border: 'none',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <option value="editor">Editor</option>
                                  <option value="viewer">Viewer</option>
                                </select>
                              )}
                              {userRole !== 'owner' && (
                                <span style={{
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  background: perm.role === 'editor' ? '#3b82f6' : '#6b7280',
                                  color: 'white'
                                }}>
                                  {perm.role === 'editor' ? 'Editor' : 'Viewer'}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : shareLink ? (
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Share Link:</label>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                      <input
                        type="text"
                        value={shareLink}
                        readOnly
                        style={{
                          flex: 1,
                          padding: '8px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '14px'
                        }}
                      />
                      <button
                        onClick={copyShareLink}
                        style={{
                          padding: '8px 16px',
                          background: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <Copy size={16} />
                        Copy
                      </button>
                    </div>
                    <button
                      onClick={revokeShareLink}
                      style={{
                        padding: '8px 16px',
                        background: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Revoke Link
                    </button>
                    
                    {/* Show shared users list */}
                    {sharedUsers.length > 0 && (
                      <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #e5e7eb' }}>
                        <label style={{ display: 'block', marginBottom: '12px', fontWeight: 'bold' }}>Shared Users:</label>
                        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                          {sharedUsers.map((perm, index) => (
                            <div key={index} style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '8px 12px',
                              marginBottom: '8px',
                              background: '#f3f4f6',
                              borderRadius: '6px'
                            }}>
                              <span style={{ fontWeight: '500', color: '#1f2937' }}>{perm.username}</span>
                              {userRole === 'owner' ? (
                                <select
                                  value={perm.role}
                                  onChange={async (e) => {
                                    const newRole = e.target.value;
                                    try {
                                      const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}/permissions`, {
                                        method: 'POST',
                                        headers: {
                                          'Content-Type': 'application/json',
                                          'Authorization': `Bearer ${userToken}`
                                        },
                                        body: JSON.stringify({ email: perm.username, role: newRole })
                                      });
                                      if (response.ok) {
                                        // Refresh shared users list
                                        const refreshResponse = await fetch(`${API_BASE_URL}/api/documents/${documentId}`, {
                                          headers: { 'Authorization': `Bearer ${userToken}` }
                                        });
                                        if (refreshResponse.ok) {
                                          const refreshedDoc = await refreshResponse.json();
                                          setSharedUsers(refreshedDoc.permissions || []);
                                        }
                                      } else {
                                        const error = await response.json();
                                        throw new Error(error.error || 'Failed to update access');
                                      }
                                    } catch (error) {
                                      console.error('Error updating user access:', error);
                                      alert('Failed to update user access: ' + error.message);
                                    }
                                  }}
                                  style={{
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    background: perm.role === 'editor' ? '#3b82f6' : '#6b7280',
                                    color: 'white',
                                    border: 'none',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <option value="editor">Editor</option>
                                  <option value="viewer">Viewer</option>
                                </select>
                              ) : (
                                <span style={{
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  background: perm.role === 'editor' ? '#3b82f6' : '#6b7280',
                                  color: 'white'
                                }}>
                                  {perm.role === 'editor' ? 'Editor' : 'Viewer'}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={generateShareLink}
                    style={{
                      padding: '10px 20px',
                      background: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '16px',
                      fontWeight: 'bold'
                    }}
                  >
                    Generate Share Link
                  </button>
                )}
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