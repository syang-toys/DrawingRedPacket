var AV = require('leanengine');
const rp = require('request-promise')

async function fetchGlobalStatus() {
    const query = new AV.Query('GlobalStatus');
    const status = await query.get('5a9d742bf84da5003e000249');
    const ret = status.get('current_id');
    status.increment('current_id', 1);
    await status.save();
    return ret;
}

function deliverRedPacket(similarity, amount, num) {
    if (similarity < 0.5) {
        return 0;
    } else if (num === 1) {
        return amount;
    } else {
        const times = Math.random() + 0.499999 + similarity / 2;
        const deliverAmount = amount * times / num;
        return deliverAmount.toFixed(2);
    }
}

async function findUser(u_id) {
    const uQuery = new AV.Query('UserModel');
    uQuery.equalTo('u_id', u_id);
    const result = await uQuery.find();
    if (result.length === 0) {
        throw new AV.Cloud.Error('No such user!');
    }
    return result[0];
}

async function findRedPacket(p_id) {
    const pQuery = new AV.Query('RedPacket');
    pQuery.equalTo('p_id', p_id);
    const result = await pQuery.find();
    if (result.length === 0) {
        throw new AV.Cloud.Error('No such red packet!');
    }
    return result[0];
}

async function modifyAmount(user, amount, needCheck) {
    user.increment('amount', amount);
    try {
        if (needCheck) {
            await user.save(null, {
                query: new AV.Query('UserModel').greaterThanOrEqualTo('amount', -amount)
            });
        } else {
            await user.save();
        }
    } catch (err) {
        if (err.code === 305) {
            throw new AV.Cloud.Error('No enough amount!');
        }
    }
}

function compareAnswer(origin, answer) {
    return Math.random().toFixed(2);
}

AV.Cloud.define('stencils', async function (request) {
    const options = {
        method: 'GET',
        url: 'https://www.autodraw.com/assets/stencils.json',
        gzip: true,
        json: true
    };
    const response = await rp(options);
    return response;
});

AV.Cloud.define('matchDraw', async function (request) {

    const options = {
        method: 'POST',
        url: 'https://inputtools.google.com/request',
        qs: {
            ime: 'handwriting',
            app: 'autodraw',
            dbg: '1',
            cs: '1',
            oe: 'UTF-8'
        },
        headers: {
            'Content-Type': 'application/json'
        },
        json: true
    }
    options.body = request.params;

    const response = await rp(options);
    return response;
});

AV.Cloud.define('queryRedPacket', async (request) => {
    const {
        p_id,
        u_id
    } = request.params;
    try {
        const user = findUser(u_id);
        if (p_id in user.p_ids) {
            ret.owner = true;
            ret.display = false;
        } else {
            ret.owner = false;
            ret.display = true;            
        }
        const packet = findRedPacket(p_id);
        for (let answer of packet.answers) {
            if (answer.u_id === u_id) {
                ret.display = false;                
                break;
            }
        }
        ret.packet = packet;
    } catch (err) {
        throw err;
    }
    return ret;
});

AV.Cloud.define('newRedPacket', async (request) => {
    const {
        u_id,
        amount,
        num,
        title
    } = request.params;
    let user;
    try {
        user = findUser();
        modifyAmount(user, -amount, true);
    } catch (err) {
        throw err;
    }
    const p_id = await fetchGlobalStatus();
    const RedPacket = AV.Object.extend('RedPacket');
    const packet = new RedPacket();
    packet.set('p_id', p_id);
    packet.set('description', description);
    packet.set('amount', amount);
    packet.set('num', num);
    packet.set('title', title);
    packet.set('answers', []);
    user.add('p_ids', p_id);
    await Promise.all([
        packet.save(),
        user.save()
    ]);
    return p_id;
});

AV.Cloud.define('newAnswer', async (request) => {
    const {
        p_id,
        u_id,
        answer
    } = request.params;
    try {
        const packet = await findRedPacket(p_id);
        const similarity = compareAnswer(packet.get('description'), answer);
        const deliverAmount = deliverRedPacket(similarity, packet.get('amount'), packet.get('num'));
        if (deliverAmount === 0) {
            throw new AV.Cloud.Error('No similarity!');
        }
        const user = await findUser(u_id);
        packet.increment('amount', -amount);
        packet.increment('num', -1);
        const ans = {
            u_id: u_id,
            similarity: similarity
        }
        packet.add('answers', ans);
        packet.fetchWhenSave(true)        
        const ret = await Promise.all([
            modifyAmount(user, deliverAmount, false),
            packet.save()
        ]);
        return ret[0];
    } catch (err) {
        throw err;
    }

    await model.save();
    return status;
});