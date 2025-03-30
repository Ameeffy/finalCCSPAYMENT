const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authenticateToken = require('../middleware/middleware');
const db = require('../config/db');

router.get('/payments/total-per-organization', authenticateToken, authController.getTotalPaymentsPerOrganization);


router.get('/notify-unpaid-transactions', authenticateToken, authController.notifyUnpaidTransactions);
router.get('/notify-product-balance-transactions', authenticateToken, authController.notifyProductTransactionBalance);
router.get('/notify-balance-transactions', authenticateToken, authController.notifyBalanceTransactions);


router.get('/organization-user/president', authenticateToken, authController.organizationsdetailsPresident);
router.get('/switch-button', authenticateToken, authController.switchButton);
router.get('/allsemesterlogs', authController.allsemesterlogs);
router.get('/preorder/:preOrderId/details', authenticateToken, authController.getPreOrderDetails);
router.put('/pre-orders/pay-balance', authenticateToken, authController.payPreOrderBalance);

router.put('/pre-orders/handle-balance', authenticateToken, authController.handleBalanceApproval);
router.put('/pre-orders/add-total-pay', authenticateToken, authController.updatePreOrderTotalPay);

router.put('/pre-orders/gcash-action', authenticateToken, authController.handleGcashPreOrder);

router.post('/Balanceupdate-preorder-proof', authenticateToken, authController.BalanceupdatePreOrderProofOfPayment);
router.post('/update-preorder-proof', authenticateToken, authController.updatePreOrderProofOfPayment);
router.post('/Rupdate-preorder-proof', authenticateToken, authController.RupdatePreOrderProofOfPayment);

router.delete('/remove-preorder', authenticateToken, authController.removePreOrderusers);

router.get('/organization/order-status', authenticateToken, authController.getOrderStatus);

// ✅ Toggle Order Status
router.put('/organization/order-status', authenticateToken, authController.toggleOrderStatus);

router.get('/pre-ordersusers', authenticateToken, authController.getUserPreOrders);

// ✅ Fetch Pre-Order logs for a specific order
router.get('/pre-orders/:pre_order_id/logs', authenticateToken, authController.getPreOrderLogs);
router.delete('/remove-preorder', authenticateToken,authController.removePreOrderusera);
router.post('/pre-orders/place-order', authController.placePreOrderAsTransaction);
router.put('/pre-orders/mark-paid', authenticateToken,authController.markPreOrderAsPaid);
router.get('/pre-orders',authenticateToken, authController.getPreOrders);

// Route to fetch logs for a specific pre-order
router.get('/pre-orders/:pre_order_id/logs',authenticateToken, authController.getPreOrderLogs);
router.post('/products/pre-order',authenticateToken, authController.createPreOrder);
router.put('/products/pre-order-limit',authenticateToken, authController.updatePreOrderLimit);
// Remove Pre-Order Status
router.delete('/products/pre-order', authenticateToken,authController.removePreOrder);
// Remove Pre-Order Status
router.delete('/products/pre-order', authenticateToken,authController.removePreOrder);
router.post('/products/pre-orderSet',authenticateToken, authController.setPreOrder);
router.put('/products/update-status', authController.updateProductStatus);


router.get('/organization/logo', authenticateToken, authController.getOrganizationLogo);
router.post('/organization/upload-logo', authenticateToken, authController.uploadOrganizationLogo);

router.get('/organization/academic-logs', authenticateToken, authController.getOrganizationAcademicLogs);




router.get('/admin-all-payments-transactions-dashboard', authenticateToken, authController.adminAllPaymentsTransactionsDashboard);
router.get('/admin-transaction-status-counts', authenticateToken, authController.adminTransactionStatusCounts);
router.get('/admin-product-transaction-status-counts', authenticateToken, authController.adminProductTransactionStatusCounts);

router.get('/admin-total-payments', authenticateToken, authController.adminTotalAmountPayments);
router.get('/admin-total-product-transactions', authenticateToken, authController.adminTotalPayTransactions);
router.get('/admin-accepted-payments-total-amount', authController.adminAcceptedPaymentsTotalAmountAndPaymentMethodCount);
router.get('/admin-reports-counts', authController.getReportsCount);

router.get('/admin-monthly-totals', authController.adminGetMonthlyTotals);
router.get('/all-payments-transactions-dashboard', authenticateToken, authController.getAllPaymentsTransactionsByOrgDashboard);
router.get('/product-review-stats', authenticateToken, authController.getProductReviewStats);
router.get('/monthly-totals', authenticateToken, authController.getMonthlyTotals);

router.get('/product-quantities-organization', authenticateToken, authController.getProductQuantitiesByOrganization);
router.get('/total-pay-organization', authenticateToken, authController.totalPayPerOrganization);
router.get('/product-transaction-status-counts', authenticateToken, authController.getProductTransactionStatusCounts);
router.get('/payments-transactions-by-semester', authenticateToken, authController.getPaymentsTransactionsBySemester);




router.get('/transaction-status-counts', authenticateToken, authController.getTransactionStatusCounts);
router.get('/total-amount-payment-organization', authenticateToken, authController.totalAmountPaymentOrganization);

router.get('/accepted-payments-total-amount-payment-method', authenticateToken, authController.acceptedPaymentsTotalAmountAndPaymentMethodCount);

router.get('/payments/active', authenticateToken, authController.getActivePaymentsByOrganization);
router.get('/payments/active/admin', authenticateToken, authController.getActivePayments);

// Route to get transactions for a given payment (paymentId passed as a URL parameter)
router.get('/payments/:paymentId/transactions', authenticateToken, authController.getTransactionsByPaymentActive);

router.get('/product-transaction-reports', authenticateToken, authController.getAllProductTransactionReports);
router.get('/all-product-transaction-reports-adviser', authenticateToken, authController.getAllProductTransactionReportsAdviser);
router.get('/all-product-transactions-by-semester-adviser', authenticateToken, authController.getAllProductTransactionsBySemesterAdviser);

router.get('/product-transactions',authenticateToken, authController.getAllProductTransactions);
router.get('/transactions/by-organizations', authenticateToken, authController.getTransactionsByOrganizations);
router.get('/transactions/all', authController.getAllTransactions);
router.get('/all-transactions-adviser', authenticateToken, authController.getAllTransactionsAdviser);

router.get('/transaction-reports', authenticateToken, authController.getTransactionReports);
router.get('/all-transaction-reports-adviser', authenticateToken, authController.getTransactionReportsAdviser);

router.post('/transactions/reports', authenticateToken, authController.addTransactionReport);


router.get('/total-users-by-role', authController.getTotalUsersByRole);
router.get('/total-genders-by-role', authController.getTotalGendersByRole);
router.get('/total-organizations',authController.getTotalOrganizations); 
router.get('/total-orders-payments',authController.getTotalOrdersPayments); 
router.get('/active-users-per-semester',authController.getActiveUsersPerSemester);
router.get('/orders-vs-payments-by-month',authController.getOrdersVsPaymentsByMonth);
router.get('/transactions-count-by-organization', authenticateToken, authController.getTransactionsCountByOrganization);


router.get('/organizations/:organization_id', authenticateToken,authController.getOrganizationById);
// Organizations Users Logs
router.get('/organizations/:organization_id/users-logs', authController.getOrganizationsUsersLogs);
router.get('/organizations/:organization_id/adviser-logs', authController.getOrganizationsAdviserLogs);
router.delete('/organizations/users-logs/:id', authenticateToken, authController.deleteOrganizationsUsersLog);

// Organizations Adviser Logs

router.delete('/organizations/adviser-logs/:id', authenticateToken, authController.deleteOrganizationsAdviserLog);
router.get('/available-years', authController.getAvailableYears);
router.get('/latest-year', authController.getLatestYear);


router.get('/checkOrderStatusAndMessage', authenticateToken, authController.checkOrderStatusAndMessage);
router.post('/validate-current-password',authenticateToken, authController.validateCurrentPassword);
router.post('/update-user-statusWeb',authenticateToken, authController.updateUserStatusWeb);
router.post('/mark-order-received',authenticateToken, authController.markOrderReceived);
router.post('/send-message', authenticateToken, authController.sendMessage);
router.get('/getAllLogs',authenticateToken,authController.getAllLogs);
router.post('/get-transaction-detailsHistory', authenticateToken,authController.getTransactionDetailsHistory);
router.post('/addannouncement', authenticateToken, authController.addAnnouncement);

// Route to get all announcements
router.get('/getannouncements', authenticateToken, authController.getAnnouncements);
router.get('/getannouncementsMobile', authenticateToken, authController.getAnnouncementsMobile);
router.post('/change-password', authenticateToken, authController.changePassword);
router.post(
  '/gcashorder',
  authenticateToken,
  authController.gcashUploadMiddleware,
  authController.insertGcashOrder
);

router.get('/gcashorders',authenticateToken, authController.getGcashOrders);
router.get('/gcashordersall',authController.getGcashOrdersall);
router.get('/gcashordersMobile', authController.getGcashOrdersMobile);
router.post('/update-transaction-balanceProof', authenticateToken, authController.updateTransactionBalanceProof);
router.post('/update-transaction-balance', authenticateToken, authController.updateTransactionBalance);
router.post(
  '/get-payment-detailsBalance',
  authenticateToken,  // Authenticate the token
  authController.getPaymentDetailsBalance  // Call the controller function to get payment details
);

router.post('/update-proof-of-payment',authenticateToken,
    authController. updateProofOfPayment);

    router.post('/update-proof-of-paymentBalance',authenticateToken,
      authController. updateProofOfPaymentBalance);
    
router.get(
    '/transaction-detailsOrders', 
    authenticateToken,
    authController.getTransactionDetailsOrders
  );

router.post('/product-transaction-details', authenticateToken, authController.getProductTransactionDetails);
router.post('/product-transaction-detailsBalance', authenticateToken, authController.getProductTransactionDetailsBalance);
router.post('/product-transaction-detailsHistory', authenticateToken, authController.getProductTransactionDetailsHistory);
router.post('/get-transaction-details', authenticateToken,authController.getTransactionDetails);
router.get('/recent-orders', authenticateToken, authController.getRecentOrders);

router.get('/transactions', authenticateToken, authController.getTransactions);

router.get('/product-logs/:productId', authenticateToken, authController.fetchProductLogs);
router.get('/organization-products-logs', authenticateToken, authController.getOrganizationProductLogs);

router.post('/addorder', authenticateToken, authController.addOrder);
router.get('/product-transaction-logs/:orderTransactionId',authenticateToken, authController.getProductTransactionLogs);
router.put('/product-transactions/:orderTransactionId/paybalance',authenticateToken, authController.updateBalancePayment);

router.put('/product-transactions/:orderTransactionId/pay', authenticateToken, authController.updateTotalPay);
router.put('/accept-order/:orderTransactionId', authenticateToken, authController.acceptOrder);

// Route to decline an order
router.put('/decline-order/:orderTransactionId',authenticateToken, authController.declineOrder);
router.put('/product-transactions/:orderTransactionId/accept-balance', authenticateToken, authController.acceptBalancePayment);
router.put('/product-transactions/:orderTransactionId/decline-balance', authenticateToken, authController.declineBalancePayment);
router.post('/product-transactions/:orderTransactionId/report-decline', authenticateToken, authController.submitDeclineReport);

router.get('/product-transactions/all', authController.getAllProductTransactionsNoAuth);
router.get('/product-transaction-logsa/:orderTransactionId', authController.getProductTransactionLogsa);

router.get('/product-transactions',authenticateToken, authController.getAllProductTransactions);
router.get('/all-product-transactions-adviser', authenticateToken, authController.getAllProductTransactionsAdviser);
router.post('/place-order', authenticateToken, authController.placeOrder);
router.delete('/reviewordersdeleteusers', authenticateToken,  authController.deleteReviewOrders);
router.get('/reviewordersusers', authenticateToken, authController.getReviewOrders);
router.post('/revieworder', authenticateToken, authController.handleReviewOrder);
router.put('/cartusersupdate/:cartItemId', authenticateToken, authController.updateCartItemQuantity);
router.get('/get-product-details', authenticateToken, authController.getProductDetails);
router.post('/cart/add',authenticateToken, authController.addToCart);

router.get('/cart', authenticateToken, authController.getUserCart);
router.get('/carthome', authenticateToken, authController.getUserCarthome);
router.get('/user/transaction-count', authenticateToken, authController.getUserTransactionCount);
router.get('/user/product-transaction-count', authenticateToken, authController.getUserProductTransactionCount);
router.get('/user/transaction-status-counts', authenticateToken, authController.getTransactionStatusCountsusers);
router.get('/user/product-transaction-status-counts', authenticateToken, authController.getProductTransactionStatusCountsusers);


router.delete('/cart/:cartItemId', authenticateToken, authController.deleteCartItem);

router.post('/login', authController.login);
router.post('/register', authController.register);
router.post('/registers', authController.registers);

router.post('/verifyUser', authController.verifyUser);
router.post('/verify-otp-users', authController.verifyOtpUsers);
router.post('/resend-otp', authController.resendOtp);
router.delete('/delete-user', authController.deleteUser);

router.post('/forgotpasswordotpverified', authController.forgotpasswordotpverified);
router.post('/forgotpasswordresend', authController.forgotpasswordresend);
router.post('/verify-otpmobile', authController.verifyOtpMobile);
router.post('/resend-otpmobile', authController.resendOtpMobile);
router.post('/delete-usermobile', authController.deleteUserMobile);

// Change passwords
router.post('/changePassworduser',authenticateToken, authController.changePassworduser);
router.post('/logincollab', authController.logincollab);

router.post('/selectAdmin', authenticateToken, authController.selectAdmin);

router.post('/send-otp-forgot-password', authController.sendOtpForgotPassword);
router.post('/verify-otp-forgot-password', authController.verifyOtpForgotPassword);
router.post('/resend-otp-forgot-password', authController.resendOtpForgotPassword);
router.post('/reset-password', authController.resetPassword);

router.post('/registerAdmin', authenticateToken, authController.registerAdmin);
router.post('/verify-admin-otp', authController.verifyAdminOtp);
router.post('/resend-admin-otp', authController.resendAdminOtp);
router.get('/alladmins', authController.getAllAdmins);
router.put('/admin/:id/status',authenticateToken, authController.toggleAdminStatus);
router.put('/admin/:id/role',authenticateToken, authController.updateAdminRole);
router.get('/admin/logs',authController.getAdminLogs);
router.get('/checkRole', authenticateToken, authController.checkAdminRole);
router.get('/admin/details', authenticateToken, authController.getAdminDetails);

router.post('/verify-current-password', authController.verifyCurrentPassword);
router.post('/update-password', authController.updatePassword);



router.post('/payments/update-proof-of-payment', authenticateToken, authController.updateProofOfPaymentP);

router.post('/semesters', authenticateToken, authController.addSemester);
router.get('/latest-semester', authController.getLatestSemester);
router.get('/allsemesters', authController.getSemesters);
router.get('/semesters/:id/logs', authController.getSemesterLogs);
router.patch('/update-semester/:id', authenticateToken, authController.updateEndDate);
router.patch('/toggle-status/:id', authenticateToken, authController.toggleStatus);
router.delete('/delete-semester/:id', authController.deleteSemester);


router.post('/payments/add', authenticateToken, authController.addPayment);
router.delete('/payments/delete/:paymentId', authenticateToken, authController.deletePayment);
router.get('/payments/all', authenticateToken, authController.getAllPayments);
router.post('/payments/accept', authenticateToken, authController.acceptPaymentOrganization);

router.put('/payments/accept-qr', authenticateToken, authController.acceptQrCodePayment);

// ❌ Decline QR Code Payment
router.put('/payments/decline-qr', authenticateToken, authController.declineQrCodePayment);
router.get('/reports/org', authenticateToken, authController.getReportsByOrg);

// Route to decline payment
router.post('/payments/decline', authenticateToken, authController.declinePaymentOrganization);
router.delete('/gcashorder/:id', authController.deleteGcashOrder);
router.get('/admin/orders', authController.getAllOrders);
router.put('/admin/orders/:orderId/status', authenticateToken, authController.updateAdminOrderStatus);
router.post('/payments/report', authenticateToken, authController.adminPaymentReports);
router.get('/gcashorder-reports',  authController.getGcashOrderReports);
router.put('/admin/payment/fees/update', authenticateToken, authController.updateAdviserFeesPriceFeesadmin);
router.get('/admin/payment/:paymentId', authController.getPaymentFeesadmin);
router.post('/admin/gcashorders/reports', authenticateToken, authController.submitGcashOrderReportadmin);


router.get('/payments/by-semester', authenticateToken, authController.getPaymentsBySemester);
router.get('/payments/by-semesterAdmin', authenticateToken, authController.getPaymentsBySemesterAdmin);
router.get('/payments/by-semesterorganization', authenticateToken, authController.getPaymentsBySemesterOrganization);
router.get('/payments/by-semesterorganizationMaster', authenticateToken, authController.getPaymentsBySemesterOrganizationMaster);
router.get('/payments/by-organization', authenticateToken, authController.getPaymentsByOrganization);
router.get('/payments/by-organizationreports', authenticateToken, authController.getPaymentsByOrganizationreports);
router.get('/payments/by-organization/all', authController.getPaymentsByOrganizationAll);
router.get('/payments/:paymentId/logs', authController.getPaymentLogs);
router.get('/all-payment-logs', authController.getPaymentLogsAll);
router.get('/organization-payment-logs', authenticateToken, authController.getOrganizationPaymentLogs);
router.get('/organization-orders-logs', authenticateToken, authController.getOrganizationGcashOrderLogs);

router.get('/all-gcashorder-logs', authController.getGcashOrderLogs);
router.get('/all-organization-logs',authController.getAllOrganizationLogs);

router.get('/all-order-transaction-reports', authController.getAllOrderTransactionReports);

router.get('/all-transaction-payment-reports', authController.getAllTransactionPaymentReports);


router.get('/reported-payments', authenticateToken, authController.getReportedPaymentsByOrganization);
router.get('/reported-payments/all', authController.getReportedPaymentsByOrganizationAll);

router.post('/payments/insert/:paymentId',authenticateToken, authController.insertPayment);
router.post('/payments/insert-multiple', authenticateToken, authController.insertMultiplePayments);
router.get('/userspaymentorgOrder',authenticateToken, authController.getUserspaymentOrder);
router.get('/userspaymentorg',authenticateToken, authController.getUserspayment);
router.get('/getAdviserorg',authenticateToken, authController.getAdviserorg);
router.get('/userspaymentorgWeb',authenticateToken, authController.getUserspaymentWeb);
router.put('/organizations/users/:user_id/update-position',authenticateToken, authController.updateUserPosition);

router.get('/transactions/:paymentId',authenticateToken, authController.getTransactionsByPaymentId);
router.get('/transactions/org',authenticateToken, authController.getTransactionsByOrganization);

router.get('/transactionsfetchmasterlist/:paymentId',authenticateToken, authController.getTransactionsByPaymentIdfetch);


router.post('/update-payment',authenticateToken, authController.updatePayment);
router.post('/update-paymentPending',authenticateToken, authController.updatePaymentPending);

router.get('/transaction-history/:transactionId', authController.getTransactionHistory);

router.post('/add-transaction', authenticateToken, authController.addTransaction);
router.post('/add-transactionPromissory', authenticateToken, authController.addTransactionPromissory);
router.post('/transactions/accept-paymentGcash/:transactionId',authenticateToken, authController.acceptPaymentGcash);

// Route to decline payment
router.post('/transactions/decline-paymentGcash/:transactionId',authenticateToken, authController.declinePaymentGcash);

router.post('/transactions/accept-payment/:transactionId',authenticateToken, authController.acceptPayment);

// Route to decline payment
router.post('/transactions/decline-payment/:transactionId',authenticateToken, authController.declinePayment);

router.post('/transactions/add-amount/:transactionId',authenticateToken, authController.addAmount);

router.post('/check-existing-transaction',authenticateToken, authController.checkExistingTransaction);

router.post('/get-payment-details', authController.getPaymentDetails);







router.post('/verify-otp', authController.verifyOtp);
router.post('/register/organization',authenticateToken, authController.registerOrganization);
router.get('/organization/details', authenticateToken, authController.getOrganizationDetails);

router.get('/organization-user/details', authenticateToken, authController.getOrganizationUserDetails);

router.post('/register/organizationuser/:organization_id', authenticateToken, authController.registerOrganizationUser);
router.post('/register/organizationuserTeacher/:organization_id', authenticateToken,authController.registerOrganizationAdviser);
router.get('/organizations', authController.getAllOrganizations);
router.get('/organizations/:orgId/users', authController.getOrganizationUserss);
router.get('/organizations/:orgId/users-logsa', authController.getOrganizationsUsersLogsa);
router.get('/organizations-users-history', authController.getOrganizationsUsersHistory);


router.get('/organizations/:orgId/advisers', authController.getOrganizationAdvisers);

router.post('/products/add/:organization_id', authenticateToken, authController.addProduct);
router.get('/products', authenticateToken, authController.getProducts);
router.get('/products/all', authenticateToken, authController.getAllProducts);

router.patch('/products/:id/update', authenticateToken, authController.updateProduct);
router.patch('/products/:productId/update-xsmall', authenticateToken, authController.updateXSmallQuantity);
router.patch('/products/:productId/update-small', authenticateToken, authController.updateSmallQuantity);
router.patch('/products/:productId/medium',authenticateToken, authController.updateMediumQuantity);
router.patch('/products/:productId/large',authenticateToken, authController.updateLargeQuantity);
router.patch('/products/:productId/xl',authenticateToken, authController.updateXLQuantity);
router.patch('/products/:productId/xxl',authenticateToken, authController.updateXXLQuantity);
router.patch('/products/:productId/xxxl',authenticateToken, authController.updateXXXLQuantity);
router.patch('/products/:productId/quantity',authenticateToken, authController.updateQuantity);


router.get('/products/:id', authenticateToken, authController.getProductById);

router.delete('/products/:productId', authenticateToken, authController.deleteProduct);


router.get('/users', authController.getUsers);
router.get('/usersStudent', authController.getUsersStudent);
router.get('/usersTeacher', authController.getUsersTeacher);
router.get('/user/:userId', authController.getUserById);
router.get('/transactions/user/:userId', authController.getTransactionsByUserId);
router.get('/transactions/user/:userId', authController.getUserTransactions);
router.get('/order-transactions/user/:userId', authController.getOrderTransactionsByUserId);

router.get('/user', authenticateToken, authController.getUserData);
router.post('/updateUserStatus', authenticateToken,authController.updateUserStatus);
router.post('/updateUserStatusGrad', authenticateToken,authController.updateUserStatusGrad);
router.get('/getsemesters_users', authController.getSemestersUsers);
router.post('/report-user',authenticateToken, authController.reportUser);
router.post('/check-report-exists', authController.checkReportExists);

router.get('/get-users-reports', authController.getUsersReports);
router.post('/apply-for-organization', authController.applyForOrganization);

router.get('/checkUserStatus', authenticateToken, authController.checkUserStatus);
router.get('/get-organization-users', authController.getOrganizationUsers);
router.put('/organizations/users/:userId/update-status',authenticateToken, authController.updateUserStatusorg);

router.post('/update-organization-status', authenticateToken, authController.updateOrganizationStatus);
router.put('/update-apply-status', authController.updateApplyStatus);
router.get('/organizations-users', authenticateToken, authController.getOrganizationsForUser);
router.post('/select-organization', authenticateToken, authController.selectOrganization);

router.put('/organizations/advisers/:adviserId/update-status', authenticateToken, authController.updateAdviserStatus);



router.post(
  '/uploadCertificate',
  authenticateToken,
  authController.uploadMiddleware,
  authController.uploadCertificate
);

router.get('/adviser/details', authenticateToken, authController.getAdviserDetails);
// Fetch payments for adviser
router.get('/adviser/payments', authenticateToken, authController.getAdviserPayments);
router.put('/adviser/payment/:paymentId/status', authenticateToken, authController.updateAdviserPaymentStatus);

router.get('/adviser/paymentsall', authenticateToken,authController. getAdviserPaymentsAll);
router.get('/adviser/orders/all', authenticateToken, authController.getAllOrdersAdviser);
router.get('/adviser/report/orders', authenticateToken, authController.getReportedOrdersByAdviser);
router.get('/adviser/report/payments', authenticateToken, authController.getReportedPaymentsByAdviser);

router.get('/adviser/orders', authenticateToken,authController.getAdviserOrders);
router.put('/adviser/orders/:orderId/status', authenticateToken, authController.updateAdviserStatusOrder);
router.post('/adviser/payments/report', authenticateToken, authController.adviserPaymentReports);
router.put('/adviser/payment/fees/update', authenticateToken, authController.updateAdviserFeesPriceFees);
router.get('/adviser/payment/:paymentId', authController.getPaymentFees);
router.post('/adviser/gcashorders/reports', authenticateToken, authController.submitGcashOrderReport);


router.get('/adviser/payment-counts', authenticateToken, authController.getAdviserPaymentCounts);
router.get('/adviser/qrcode-counts', authenticateToken, authController.getAdviserQrCodeCounts);
router.get('/adviser/payment-report-count', authenticateToken, authController.getAdviserPaymentReportCount);
router.get('/adviser/gcash-order-report-count', authenticateToken, authController.getAdviserGcashOrderReportCount);
router.get('/adviser/organizations', authenticateToken, authController.getAdviserOrganization);
router.get('/adviser/payment-count', authenticateToken, authController.getAdviserPaymentCount);
router.get('/adviser/gcashorder-count', authenticateToken, authController.getAdviserGcashOrderCount);

router.get('/adviser-payments-total', authenticateToken, authController.getAdviserPaymentsWithTotal);

router.get('/all-product-transactions-by-semester-admin', authController.getAllProductTransactionsBySemesterAdmin);
router.get('/admin-payments-total', authController.getAdminPaymentsWithTotal);
router.get('/adviser/organization-users', authenticateToken, authController.getAdviserOrganizationUsers);


router.get('/payments/organization', authenticateToken, authController.getOrganizationsPaymentsWithTotal);

// Route to fetch all product transactions by semester for a specific organization
router.get('/transactions/product/organization', authenticateToken, authController.getAllProductTransactionsBySemesterOrganization);





router.put('/organization/payment/fees/update', authenticateToken, authController.updateOrganizationFeesPriceFees);

router.post('/payments/:paymentId/comments', authenticateToken, authController.addPaymentComment);
router.get('/payments/:paymentId/comments', authController.getPaymentComments);
router.post('/payments/mark-seen', authController.markPricesFeesAsSeen);

router.get('/organizations-year', authController.getOrganizationsYearGrouped);
router.get('/organization-logs/:organizationId', authController.getOrganizationLogs);
router.get('/organizations/users/:userId/history', authController.getOrganizationUserHistory);



router.post('/payments/filtered-by-user',authenticateToken, authController.getFilteredPaymentsByUser);

router.delete('/delete-organization-year',authenticateToken, authController.deleteOrganizationYear);

module.exports = router;


