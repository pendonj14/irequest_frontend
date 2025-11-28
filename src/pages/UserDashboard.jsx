import { useState, useEffect, useRef } from 'react' // Added useRef
import axiosInstance from '../utils/axios'
import { jwtDecode } from "jwt-decode"; 
import { Menu, CreditCard, Image as ImageIcon, Trash2, Bell, X, Check } from 'lucide-react'; // Added Bell, X, Check
import { UserSidebar } from '../components/UserSidebar';
import RequestDocumentModal from '../components/RequestDocumentModal';
import UploadPaymentModal from '../components/UploadPaymentModal';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';
import useAutoFetchRequests from '../hooks/useAutoFetchRequests';
import toast from 'react-hot-toast';

function UserDashboard() {
  // --- UI STATE ---
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedPaymentRequest, setSelectedPaymentRequest] = useState(null);
  const [activePage, setActivePage] = useState('Pending');

  // --- NOTIFICATION STATE (New) ---
  const [notifications, setNotifications] = useState([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const prevRequestsRef = useRef([]); // To track previous state for comparison

  // --- DELETE STATE ---
  const [deleteState, setDeleteState] = useState({
    isOpen: false,
    type: null, // 'single' or 'all'
    data: null  // the request object (if single)
  });

  // --- DATA STATE ---
  // Polling every 3 seconds
  const { requests: myRequests, loading: requestsLoading, refresh } = useAutoFetchRequests(3000);

  // --- NOTIFICATION LOGIC ---
  useEffect(() => {
    // Only run comparison if we have previous data and new data
    if (prevRequestsRef.current.length > 0 && myRequests.length > 0) {
      const newNotifs = [];

      myRequests.forEach(newReq => {
        // Find the same request in the previous data
        const oldReq = prevRequestsRef.current.find(r => r.id === newReq.id);

        // Check if status changed
        if (oldReq && oldReq.request_status !== newReq.request_status) {
          newNotifs.push({
            id: Date.now() + newReq.id, // Unique ID for notification
            title: 'Status Updated',
            message: `"${newReq.request}" is now ${newReq.request_status}`,
            timestamp: new Date(),
            read: false
          });
          
          // Optional: Toast alert as well
          toast.success(`Request updated: ${newReq.request_status}`);
        }
      });

      if (newNotifs.length > 0) {
        setNotifications(prev => [...newNotifs, ...prev]);
      }
    }

    // Update the ref to the current data for the next render cycle
    prevRequestsRef.current = myRequests;
  }, [myRequests]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleClearNotifications = () => {
    setNotifications([]);
    setIsNotifOpen(false);
  };

  // --- USER PROFILE STATE ---
  const [user, setUser] = useState({ 
    full_name: 'Loading...', 
    program: '', 
    student_id: '' 
  });
  const [profileLoading, setProfileLoading] = useState(true);

  // --- FETCH USER PROFILE ---
  useEffect(() => {
    const fetchUserProfile = async () => {
        try {
            const response = await axiosInstance.get('user/profile/');
            setUser({
                full_name: response.data.full_name,
                program: response.data.program,
                student_id: response.data.student_id
            });
        } catch (error) {
            console.error("Error fetching user profile:", error);
            const token = localStorage.getItem('access_token');
            if (token) {
                try {
                    const decoded = jwtDecode(token);
                    setUser(prev => ({ 
                        ...prev, 
                        full_name: decoded.username, 
                        student_id: decoded.username 
                    }));
                } catch (e) { console.error(e); }
            }
        } finally {
            setProfileLoading(false);
        }
    };

    fetchUserProfile();
  }, []);

  const handlePayClick = (request) => {
    setSelectedPaymentRequest(request);
    setIsPaymentModalOpen(true);
  };

  // --- DELETE HANDLERS ---
  const openDeleteModal = (type, data = null) => {
    setDeleteState({
        isOpen: true,
        type: type,
        data: data
    });
  };

  const handleConfirmDelete = async () => {
    try {
        if (deleteState.type === 'single') {
            await axiosInstance.delete(`/requests/${deleteState.data.id}/`);
            toast.success("Record deleted successfully");
        } else if (deleteState.type === 'all') {
            await axiosInstance.delete(`/requests/delete-history/`); 
            toast.success("History cleared successfully");
        }
        refresh(); 
    } catch (error) {
        console.error("Delete error:", error);
        toast.error("Failed to delete. Please try again.");
    } finally {
        setDeleteState({ isOpen: false, type: null, data: null });
    }
  };

  // --- STATS CALCULATION ---
  const pendingCount = myRequests.filter(req => req.request_status === 'Pending').length;
  const toPayCount = myRequests.filter(req => req.request_status === 'To Pay').length;
  const completedCount = myRequests.filter(req => req.request_status === 'Confirmed').length;
  const rejectedCount = myRequests.filter(req => req.request_status === 'Rejected' || req.request_status === 'Released').length;

  // --- FILTER DISPLAYED REQUESTS ---
  const displayedRequests = myRequests.filter(req => {
    if (activePage === 'Pending') return req.request_status === 'Pending';
    if (activePage === 'To Pay') return req.request_status === 'To Pay';
    if (activePage === 'Completed') return req.request_status === 'Confirmed';
    if (activePage === 'Rejected') return req.request_status === 'Rejected' || req.request_status === 'Released';
    return false;
  });

  const isLoading = requestsLoading && profileLoading;
  const isHistoryPage = activePage === 'Rejected'; 

  return (
    <div className="fixed inset-0 bg-[#f8f9fc] overflow-y-auto">
      
      <UserSidebar 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        user={user}
        activePage={activePage}
        onPageChange={setActivePage}
        onRequestClick={() => setIsRequestModalOpen(true)}
        stats={{
            pending: pendingCount,
            toPay: toPayCount,
            completed: completedCount,
            rejected: rejectedCount
        }}
      />

      {/* MODALS */}
      <RequestDocumentModal 
        isOpen={isRequestModalOpen} 
        onClose={() => setIsRequestModalOpen(false)}
        onSuccess={refresh} 
        userProgram={user.program}
      />

      <UploadPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        request={selectedPaymentRequest}
        onSuccess={refresh} 
      />

      <DeleteConfirmationModal
        isOpen={deleteState.isOpen}
        onClose={() => setDeleteState({ ...deleteState, isOpen: false })}
        onConfirm={handleConfirmDelete}
        isDeleteAll={deleteState.type === 'all'}
        title={deleteState.type === 'all' ? "Clear Entire History?" : "Delete Request Record?"}
        message={deleteState.type === 'all' 
            ? "This will permanently remove all your Rejected and Released request records. This action cannot be undone." 
            : `Are you sure you want to remove the record for "${deleteState.data?.request}"? This cannot be undone.`
        }
      />

      <main className="relative p-6 md:p-10 md:ml-72 transition-all duration-300 min-h-full">
        
        <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 relative">
            <div className="flex items-center gap-4">
                <button 
                    onClick={() => setIsSidebarOpen(true)}
                    className="p-2 bg-white rounded-lg shadow-sm border border-gray-100 text-gray-600 md:hidden hover:bg-gray-50"
                >
                    <Menu size={24} />
                </button>
                <div>
                  {
                    activePage === 'Completed'
                      ? <h1 className="text-2xl font-bold text-[#1a1f63]">To Claim</h1>
                      : activePage === 'Rejected'
                        ? <h1 className="text-2xl font-bold text-[#1a1f63]">Completed Tasks</h1>
                        : <h1 className="text-2xl font-bold text-[#1a1f63]">{activePage}</h1>
                  }
                    <p className="text-gray-500 text-sm">Manage your document requests.</p>
                </div>
            </div>

            {/* HEADER ACTIONS: Notifications & Clear History */}
            <div className="flex items-center gap-3 self-end md:self-auto">
                
                {/* --- NOTIFICATION BELL --- */}
                <div className="relative">
                    <button 
                        onClick={() => setIsNotifOpen(!isNotifOpen)}
                        className="p-2 bg-white rounded-xl border border-gray-100 shadow-sm text-gray-600 hover:bg-gray-50 hover:text-[#1a1f63] transition-all relative"
                    >
                        <Bell size={20} />
                        {unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
                                {unreadCount}
                            </span>
                        )}
                    </button>

                    {/* Notification Dropdown */}
                    {isNotifOpen && (
                        <div className="absolute right-0 mt-3 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                            <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
                                <h3 className="font-bold text-[#1a1f63]">Notifications</h3>
                                {notifications.length > 0 && (
                                    <div className="flex gap-2">
                                        <button onClick={handleMarkRead} title="Mark all read" className="text-gray-400 hover:text-[#1a1f63]">
                                            <Check size={16} />
                                        </button>
                                        <button onClick={handleClearNotifications} title="Clear all" className="text-gray-400 hover:text-red-500">
                                            <X size={16} />
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="max-h-[300px] overflow-y-auto">
                                {notifications.length === 0 ? (
                                    <div className="p-8 text-center text-gray-400 text-sm">
                                        No new notifications
                                    </div>
                                ) : (
                                    notifications.map((notif) => (
                                        <div key={notif.id} className={`p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors ${!notif.read ? 'bg-blue-50/30' : ''}`}>
                                            <div className="flex justify-between items-start mb-1">
                                                <span className={`text-xs font-bold ${!notif.read ? 'text-[#1a1f63]' : 'text-gray-500'}`}>
                                                    {notif.title}
                                                </span>
                                                <span className="text-[10px] text-gray-400">
                                                    {notif.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-600 leading-snug">{notif.message}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* DELETE ALL BUTTON (History Page Only) */}
                {isHistoryPage && displayedRequests.length > 0 && (
                    <button
                        onClick={() => openDeleteModal('all')}
                        className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-100 rounded-xl hover:bg-red-100 hover:border-red-200 transition-all font-semibold text-sm shadow-sm"
                    >
                        <Trash2 size={16} />
                        <span className="hidden md:inline">Clear History</span>
                    </button>
                )}
            </div>
        </header>

        <div className="space-y-4">
            {isLoading ? (
                <div className="text-center py-10 text-gray-400">Loading requests...</div>
            ) : displayedRequests.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
                    <p className="text-gray-400 mb-2">No requests found in {activePage}.</p>
                    {activePage === 'Pending' && (
                        <button 
                            onClick={() => setIsRequestModalOpen(true)}
                            className="text-[#1a1f63] font-bold hover:underline"
                        >
                            Create a new request
                        </button>
                    )}
                </div>
            ) : (
                displayedRequests.map((req) => (
                    <div key={req.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between md:items-center gap-4 hover:shadow-md transition-shadow group relative">
                        <div className="flex-1">
                            <h3 className="font-bold text-gray-800 text-lg">{req.request}</h3>
                            <div className="flex flex-wrap gap-2 mt-1">
                                <p className="text-sm text-gray-500">Requested: {new Date(req.created_at).toLocaleDateString()}</p>
                                {req.claim_date && (
                                    <span className="text-xs text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-md">
                                        Claim: {req.claim_date}
                                    </span>
                                )}
                                
                                {req.request_status === 'To Pay' && req.payment_proof_url && (
                                    <span className="text-[10px] md:text-xs font-semibold text-[#1a1f63] bg-yellow-400 px-2 py-0.5 rounded border border-yellow-300 animate-pulse">
                                        Verifying Payment
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* STATUS & ACTIONS SECTION */}
                        <div className="flex flex-row md:flex-col items-center md:items-end gap-3 justify-between md:justify-start w-full md:w-auto">
                            
                            <div className="flex items-center gap-3">
                              
                              {/* SINGLE DELETE BUTTON - Only on History Page */}
                              {isHistoryPage && (
                                  <button
                                      onClick={(e) => {
                                          e.stopPropagation();
                                          openDeleteModal('single', req);
                                      }}
                                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                                      title="Delete from history"
                                  >
                                      <Trash2 size={18} />
                                  </button>
                              )}
                                {/* Only show BADGE if status is NOT 'To Pay' */}
                                {req.request_status !== 'To Pay' && (
                                    <span className={`px-4 py-2 rounded-full text-xs font-bold capitalize ${
                                        req.request_status === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
                                        req.request_status === 'Confirmed' ? 'bg-green-600 text-white' :
                                        req.request_status === 'Released' ? 'bg-gray-100 text-gray-700' :
                                        req.request_status === 'Rejected' ? 'bg-red-100 text-red-700' :
                                        'bg-gray-100 text-gray-600'
                                    }`}>
                                        {req.request_status}
                                    </span>
                                )}
                            
                            </div>

                            {/* Show COST and BUTTON if status IS 'To Pay' */}
                            {req.request_status === 'To Pay' && (
                            <div className="flex flex-col items-end gap-1 mt-2 md:mt-0">
                                <div className="flex items-center gap-3">
                                    <div className="text-right mr-1">
                                        <p className="text-xs text-gray-500 font-medium">Total Fee</p>
                                        <p className="text-lg font-bold text-[#1a1f63]">₱{req.cost || '0.00'}</p>
                                    </div>
                                    <button 
                                        onClick={() => handlePayClick(req)}
                                        className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 text-white ${
                                            req.payment_proof_url 
                                                ? "bg-[#1a1f63] hover:bg-indigo-900" 
                                                : "bg-[#1a1f63] hover:bg-indigo-900" 
                                        }`}
                                    >
                                        {req.payment_proof_url ? <ImageIcon size={16} /> : <CreditCard size={16} />}
                                        {req.payment_proof_url ? "View Receipt" : "Upload Payment"} 
                                    </button>
                                </div>
                            </div>
                            )}
                        </div>
                    </div>
                ))
            )}
        </div>

      </main>
    </div>
  )
}

export default UserDashboard;