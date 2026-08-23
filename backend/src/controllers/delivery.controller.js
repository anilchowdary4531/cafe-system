/**
 * Delivery Partner Controller
 */

export const assignDeliveryPartner = async (req, res) => {
  try {
    const { orderId, partnerId, partnerName, partnerPhone, vehicleNo } = req.body;

    if (!orderId || !partnerName) {
      return res.status(400).json({ success: false, message: 'OrderId and partnerName are required' });
    }

    const assignment = {
      orderId: parseInt(orderId),
      partnerId: partnerId || 101,
      partnerName: partnerName || 'Ramesh Kumar',
      partnerPhone: partnerPhone || '+91 9876543210',
      vehicleNo: vehicleNo || 'TS09-EZ-4589',
      status: 'ASSIGNED',
      assignedAt: new Date().toISOString()
    };

    // Emit Socket.IO event if io instance is present
    if (req.app.get('io')) {
      const io = req.app.get('io');
      io.to(`order_${orderId}`).emit('delivery_status_update', {
        orderId: parseInt(orderId),
        status: 'ASSIGNED',
        deliveryPartner: assignment
      });
    }

    return res.json({
      success: true,
      message: `Delivery partner ${assignment.partnerName} assigned to Order #${orderId}`,
      assignment
    });
  } catch (error) {
    console.error('Assign Delivery Error:', error);
    return res.status(500).json({ success: false, message: 'Server error assigning delivery partner' });
  }
};

export const updateDeliveryStatus = async (req, res) => {
  try {
    const { orderId, status, lat, lng } = req.body;

    if (!orderId || !status) {
      return res.status(400).json({ success: false, message: 'OrderId and status are required' });
    }

    const validStatuses = ['ACCEPTED', 'PICKED_UP', 'ON_THE_WAY', 'DELIVERED'];
    const cleanStatus = status.toUpperCase();

    if (!validStatuses.includes(cleanStatus)) {
      return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const updatePayload = {
      orderId: parseInt(orderId),
      status: cleanStatus,
      lat: lat || 17.3850,
      lng: lng || 78.4867,
      updatedAt: new Date().toISOString()
    };

    // Emit Socket.IO event to order room
    if (req.app.get('io')) {
      const io = req.app.get('io');
      io.to(`order_${orderId}`).emit('delivery_status_update', updatePayload);
    }

    return res.json({
      success: true,
      message: `Delivery status updated to ${cleanStatus} for Order #${orderId}`,
      update: updatePayload
    });
  } catch (error) {
    console.error('Update Delivery Status Error:', error);
    return res.status(500).json({ success: false, message: 'Server error updating delivery status' });
  }
};

export const getDeliveryPartners = async (req, res) => {
  try {
    const partners = [
      { id: 101, name: 'Ramesh Kumar', phone: '+91 9876543210', vehicleNo: 'TS09-EZ-4589', rating: 4.9, isAvailable: true },
      { id: 102, name: 'Suresh Reddy', phone: '+91 9876543211', vehicleNo: 'TS07-FX-1234', rating: 4.8, isAvailable: true },
      { id: 103, name: 'Vikram Singh', phone: '+91 9876543212', vehicleNo: 'TS08-AB-9876', rating: 4.7, isAvailable: false }
    ];

    return res.json({ partners });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error fetching delivery partners' });
  }
};
